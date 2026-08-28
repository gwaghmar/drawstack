import { NextResponse } from "next/server";
import { generateText } from "ai";
import { and, eq, gt, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { buildLanguageModel, getProviderMeta, type AiProvider } from "@/lib/ai-providers";
import { decryptAiApiKey, isAiKeyEncryptionConfigured } from "@/lib/ai-key-crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  buildEngineV2GenerationPrompt,
  classifyEngineV2Prompt,
  compileEngineV2ModelOutput,
  validateEngineV2Document,
} from "@/lib/engine-v2/compiler";
import { rateLimit } from "@/lib/rate-limit";
import { ensureUserAndWorkspace } from "@/lib/user-sync";

export const maxDuration = 60;

async function takeCredit(userId: string): Promise<boolean> {
  const result = await db.update(users)
    .set({ creditsBalance: sql`${users.creditsBalance} - 1` })
    .where(and(eq(users.id, userId), gt(users.creditsBalance, 0)))
    .returning({ id: users.id });
  return result.length > 0;
}

async function refundCredit(userId: string): Promise<void> {
  await db.update(users)
    .set({ creditsBalance: sql`${users.creditsBalance} + 1` })
    .where(eq(users.id, userId));
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { user } = await ensureUserAndWorkspace(email);
  const limit = await rateLimit(`engine-v2:${user.id}`, 20, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });

  const body = await request.json() as { prompt?: unknown; currentDocument?: unknown };
  if (typeof body.prompt !== "string") return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  let intent;
  try {
    intent = classifyEngineV2Prompt(body.prompt);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid prompt" }, { status: 400 });
  }

  const headerKey = request.headers.get("x-openai-key")?.trim() || null;
  let apiKey = headerKey;
  let provider = (user.aiProvider ?? "google") as AiProvider;
  let model = user.aiModel?.trim() || getProviderMeta(provider).defaultModel;
  let baseUrl = user.aiBaseUrl?.replace(/\/$/, "") ?? null;
  let usesOwnKey = Boolean(headerKey);

  if (!apiKey && user.aiApiKeyCipher) {
    if (!isAiKeyEncryptionConfigured()) {
      return NextResponse.json({ error: "The saved AI key cannot be opened because server encryption is not configured." }, { status: 500 });
    }
    try {
      apiKey = decryptAiApiKey(user.aiApiKeyCipher);
      usesOwnKey = true;
    } catch {
      return NextResponse.json({ error: "The saved AI key could not be opened. Save it again in Settings." }, { status: 400 });
    }
  }

  if (!apiKey) {
    if (process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY;
      provider = "openai";
      model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-lite";
      baseUrl = "https://openrouter.ai/api/v1";
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      provider = "google";
      model = process.env.GOOGLE_MODEL?.trim() || "gemini-flash-latest";
      baseUrl = null;
    } else if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
      provider = "openai";
      model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? null;
    }
  }

  if (!apiKey) return NextResponse.json({ error: "No AI key is configured. Add one in Settings." }, { status: 400 });

  const shouldCharge = user.plan === "free" && !usesOwnKey;
  if (shouldCharge && !(await takeCredit(user.id))) {
    return NextResponse.json({ error: "No credits left. Add your own AI key or upgrade." }, { status: 402 });
  }

  try {
    const languageModel = buildLanguageModel(provider, model, apiKey, baseUrl);
    const current = body.currentDocument === undefined ? null : validateEngineV2Document(body.currentDocument);
    const currentContext = current?.ok
      ? `\nRevise this existing EngineDocument when the request implies an edit. Preserve unrelated nodes and IDs:\n${JSON.stringify(current.document)}`
      : "";
    const system = buildEngineV2GenerationPrompt(intent);
    const first = await generateText({
      model: languageModel,
      system,
      prompt: `${intent.normalizedPrompt}${currentContext}`,
      temperature: 0.15,
      maxOutputTokens: 6_000,
      abortSignal: AbortSignal.timeout(25_000),
    });
    let compiled = compileEngineV2ModelOutput(intent.normalizedPrompt, first.text);

    if (!compiled.ok) {
      const repair = await generateText({
        model: languageModel,
        system,
        prompt: `Repair the invalid output. Return one complete JSON object only.\nValidation issues:\n${JSON.stringify(compiled.issues.slice(0, 20))}\nInvalid output:\n${first.text.slice(0, 100_000)}`,
        temperature: 0,
        maxOutputTokens: 6_000,
        abortSignal: AbortSignal.timeout(20_000),
      });
      compiled = compileEngineV2ModelOutput(intent.normalizedPrompt, repair.text);
    }

    if (!compiled.ok) {
      if (shouldCharge) await refundCredit(user.id);
      return NextResponse.json({ error: "The model returned an invalid document.", issues: compiled.issues.slice(0, 20) }, { status: 422 });
    }

    return NextResponse.json({ document: compiled.document, intent: compiled.intent });
  } catch (error) {
    if (shouldCharge) await refundCredit(user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}

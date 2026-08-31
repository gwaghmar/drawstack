import { NextResponse } from "next/server";
import { generateText } from "ai";
import { and, eq, gt, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { buildLanguageModel } from "@/lib/ai-providers";
import { getHostedAiConfig } from "@/lib/hosted-ai";
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
import { applyAiScope, type EngineAiScope } from "@/lib/engine-v2/ai-scope";

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

  const body = await request.json() as { prompt?: unknown; currentDocument?: unknown; scope?: unknown; selectedNodeIds?: unknown };
  if (typeof body.prompt !== "string") return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  const scope: EngineAiScope = body.scope === "edit" ? "edit" : "create";
  const selectedNodeIds = Array.isArray(body.selectedNodeIds) && body.selectedNodeIds.every((id) => typeof id === "string")
    ? [...new Set(body.selectedNodeIds)] as string[]
    : [];
  if (scope === "edit" && selectedNodeIds.length === 0) return NextResponse.json({ error: "Select at least one node to edit." }, { status: 400 });

  let intent;
  try {
    intent = classifyEngineV2Prompt(body.prompt);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid prompt" }, { status: 400 });
  }

  const hostedAi = getHostedAiConfig();
  if (!hostedAi) return NextResponse.json({ error: "Hosted AI is temporarily unavailable." }, { status: 503 });

  const shouldCharge = user.plan === "free";
  if (shouldCharge && !(await takeCredit(user.id))) {
    return NextResponse.json({ error: "No credits left. Upgrade or contact support." }, { status: 402 });
  }

  try {
    const languageModel = buildLanguageModel(hostedAi.provider, hostedAi.model, hostedAi.apiKey, hostedAi.baseUrl);
    const current = body.currentDocument === undefined ? null : validateEngineV2Document(body.currentDocument);
    if (scope === "edit" && (!current || !current.ok)) {
      if (shouldCharge) await refundCredit(user.id);
      return NextResponse.json({ error: "The current document is invalid and cannot be edited safely." }, { status: 400 });
    }
    const currentContext = current?.ok
      ? `\nOperation scope: ${scope}. Selected node ids: ${JSON.stringify(selectedNodeIds)}. For edit, change only those selected nodes, preserve every unrelated node and its id, and include the selected ids in the returned document. Existing document:\n${JSON.stringify(current.document)}`
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

    const scoped = applyAiScope(current?.ok ? current.document : null, compiled.document, scope, selectedNodeIds);
    return NextResponse.json({ document: scoped.document, intent: compiled.intent, transaction: scoped.transaction, changeSummary: scoped.summary });
  } catch (error) {
    if (shouldCharge) await refundCredit(user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}

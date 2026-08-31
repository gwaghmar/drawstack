import { NextResponse } from "next/server";
import { generateText } from "ai";
import { and, eq, gt, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { buildLanguageModel } from "@/lib/ai-providers";
import { getHostedAiConfig } from "@/lib/hosted-ai";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { rateLimit } from "@/lib/rate-limit";
import { validateEngineV3Document } from "@/lib/engine-v3/compiler";
import { createEngineV3AgentReadView, parseEngineV3AgentModelText, parseEngineV3AgentProposal } from "@/lib/engine-v3/agent-proposal";

export const maxDuration = 60;

const SYSTEM = `You propose safe edits to a version 3 drawstack visual document. Return one JSON object only:
{"commands":[EngineV3Command,...],"explanation":"short user-facing summary"}
Supported commands:
- {"kind":"node","action":"patch","pageId":"...","nodeId":"...","changes":{...},"unset":[...]}
- {"kind":"node","action":"add","pageId":"...","parentId":"frame-id","node":{...}}
- {"kind":"node","action":"remove|duplicate|ungroup","pageId":"...","nodeId":"..."}
- {"kind":"node","action":"reorder","pageId":"...","nodeId":"...","toIndex":0}
- {"kind":"node","action":"group","pageId":"...","nodeIds":["...","..."],"frame":{...}}
- {"kind":"page","action":"add|remove|rename","page":{...}}
- {"kind":"tokens","tokens":{...}}
Never invent a target ID for patch, remove, duplicate, reorder, group, or ungroup. New IDs must start with a letter and contain only letters, digits, underscore, or hyphen. Preserve unrelated content. Do not change assets, components, permissions, sharing, billing, or authentication. Safe mode permits only patch commands against the selected IDs and only name, content, alt, style, transform, opacity, or visible fields.`;

async function takeCredit(userId: string): Promise<boolean> {
  return (await db.update(users).set({ creditsBalance: sql`${users.creditsBalance} - 1` }).where(and(eq(users.id, userId), gt(users.creditsBalance, 0))).returning({ id: users.id })).length > 0;
}

async function refundCredit(userId: string): Promise<void> {
  await db.update(users).set({ creditsBalance: sql`${users.creditsBalance} + 1` }).where(eq(users.id, userId));
}

export async function POST(request: Request) {
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { user } = await ensureUserAndWorkspace(email);
  const limited = await rateLimit(`engine-v3:${user.id}`, 20, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  const body = await request.json() as { prompt?: unknown; document?: unknown; revision?: unknown; selectedNodeIds?: unknown; safeMode?: unknown };
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 4_000) return NextResponse.json({ error: "A prompt between 1 and 4000 characters is required." }, { status: 400 });
  const validated = validateEngineV3Document(body.document);
  if (!validated.ok) return NextResponse.json({ error: "The current document is invalid.", diagnostics: validated.issues }, { status: 400 });
  const revision = Number.isInteger(body.revision) && (body.revision as number) >= 0 ? body.revision as number : 0;
  const selectedNodeIds = Array.isArray(body.selectedNodeIds) && body.selectedNodeIds.every((id) => typeof id === "string") ? [...new Set(body.selectedNodeIds)] as string[] : [];
  const safeMode = body.safeMode !== false;
  if (safeMode && selectedNodeIds.length === 0) return NextResponse.json({ error: "Select at least one node for safe AI editing." }, { status: 400 });
  const hosted = getHostedAiConfig();
  if (!hosted) return NextResponse.json({ error: "Hosted AI is temporarily unavailable." }, { status: 503 });
  const shouldCharge = user.plan === "free";
  if (shouldCharge && !(await takeCredit(user.id))) return NextResponse.json({ error: "No credits left. Upgrade or contact support." }, { status: 402 });
  try {
    const model = buildLanguageModel(hosted.provider, hosted.model, hosted.apiKey, hosted.baseUrl);
    const context = safeMode ? createEngineV3AgentReadView(validated.document, selectedNodeIds) : validated.document;
    const generate = (prompt: string) => generateText({ model, system: SYSTEM, prompt, temperature: 0.1, maxOutputTokens: 5_000, abortSignal: AbortSignal.timeout(25_000) });
    const first = await generate(`User request: ${body.prompt.trim()}\nSafe mode: ${safeMode}\nCurrent revision: ${revision}\nDocument context:\n${JSON.stringify(context)}`);
    let proposal = parseEngineV3AgentProposal(parseEngineV3AgentModelText(first.text), validated.document, revision, selectedNodeIds, safeMode);
    if (!proposal.ok) {
      const repair = await generate(`Repair the rejected proposal for this user request: ${body.prompt.trim()}\nDiagnostics: ${JSON.stringify(proposal.diagnostics)}\nDocument context:\n${JSON.stringify(context)}\nRejected output:\n${first.text.slice(0, 60_000)}`);
      proposal = parseEngineV3AgentProposal(parseEngineV3AgentModelText(repair.text), validated.document, revision, selectedNodeIds, safeMode);
    }
    if (!proposal.ok) {
      if (shouldCharge) await refundCredit(user.id);
      return NextResponse.json({ error: "The AI proposal could not be validated.", diagnostics: proposal.diagnostics }, { status: 422 });
    }
    return NextResponse.json({ proposal: proposal.proposal });
  } catch (error) {
    if (shouldCharge) await refundCredit(user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}

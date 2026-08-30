import { NextResponse } from "next/server";
import { generateText, streamText, createUIMessageStream, createUIMessageStreamResponse, type UIMessageStreamWriter } from "ai";
import { and, eq, gt, sql } from "drizzle-orm";
import { DIAGRAM_SYSTEM_PROMPTS, USE_CASE_STYLE_INSTRUCTIONS, getDiagramTypeMeta, buildComplexityDirective, getFollowUpSuggestions, MODE_PERSONAS, ANTI_GENERIC_DIRECTIVE } from "@flowchart/core";
import type { DiagramType, SocialPresetId, UseCaseId, EditorMode } from "@flowchart/core";
import type { ApiError } from "@flowchart/core";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { decryptAiApiKey, isAiKeyEncryptionConfigured } from "@/lib/ai-key-crypto";
import { buildLanguageModel, getProviderMeta, type AiProvider } from "@/lib/ai-providers";
import { rateLimit } from "@/lib/rate-limit";
import { lastUserText, toChatTurns, type ChatTurn } from "@/lib/ai-messages";
import { buildBrandDirective } from "@/lib/brand-directive";
import { recordAiEvent } from "@/lib/ai-events";
import { validateAndRepairOutput, parsePossiblyBrokenJson } from "@/lib/diagrams/validate-output";
import { autoLayoutFreeformDocument } from "@/lib/diagrams/freeform-autolayout";
import { repairOverlaps } from "@/lib/diagrams/freeform-layout-check";

export const maxDuration = 60;

// Cap each AI call so a hung provider can't block the request for the full
// function budget. Kept under maxDuration so the abort fires first.
const GENERATION_TIMEOUT_MS = 25_000;
const CORRECTIVE_TIMEOUT_MS = 15_000;

type DetailLevel = "low" | "medium" | "high";
type IntentPlan = {
  intentSummary: string;
  primaryGoal: string;
  entities: string[];
  steps: string[];
  relationships: string[];
  requestedStyle: string[];
  assumptions: string[];
  missingInfo: string[];
  requiredComponents: string[];
  ambiguityScore: number;
  detailLevel: DetailLevel;
  shouldAskClarification: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
  suggestedPresetId?: SocialPresetId | null;
  suggestedDiagramType?: DiagramType | null;
  /** "graph" = shapes are connected nodes with no deliberate hand-composed
   * layout (flowchart/ERD/org-chart/dependency-graph shaped) -- safe for the
   * engine to auto-arrange. Omitted/null = leave the model's own positions
   * alone (poster/dashboard/infographic compositions, where position IS the
   * design). Conservative default: no layout unless the model says so. */
  layoutHint?: "graph" | null;
};

async function tryDecrementCredit(userId: string): Promise<boolean> {
  const out = await db
    .update(users)
    .set({ creditsBalance: sql`${users.creditsBalance} - 1` })
    .where(and(eq(users.id, userId), gt(users.creditsBalance, 0)))
    .returning({ id: users.id });
  return out.length > 0;
}

async function refundCredit(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ creditsBalance: sql`${users.creditsBalance} + 1` })
    .where(eq(users.id, userId));
}

function clampAmbiguityScore(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferDetailLevel(prompt: string): DetailLevel {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 45) return "high";
  if (words <= 12) return "low";
  return "medium";
}

function defaultIntentPlan(prompt: string): IntentPlan {
  const detailLevel = inferDetailLevel(prompt);
  return {
    intentSummary: prompt.slice(0, 220),
    primaryGoal: "Generate a coherent diagram from user intent",
    entities: [],
    steps: [],
    relationships: [],
    requestedStyle: [],
    assumptions: detailLevel === "low" ? ["User wants a sensible starter flow"] : [],
    missingInfo: detailLevel === "low" ? ["Domain specifics"] : [],
    requiredComponents: [],
    ambiguityScore: detailLevel === "low" ? 65 : 35,
    detailLevel,
    shouldAskClarification: false,
    clarificationQuestion: undefined,
    suggestedPresetId: null,
  };
}

const VALID_PRESET_IDS: SocialPresetId[] = ["square_feed", "vertical_feed", "story_reel", "landscape", "link_preview"];
const VALID_DIAGRAM_TYPES: DiagramType[] = ["freeform"];

function parseIntentPlan(raw: string, prompt: string): IntentPlan & { _fallback?: boolean } {
  const repaired = parsePossiblyBrokenJson(raw);
  if (!repaired) return { ...defaultIntentPlan(prompt), _fallback: true };
  try {
    const parsed = JSON.parse(repaired) as Partial<IntentPlan>;
    const detailLevel: DetailLevel =
      parsed.detailLevel === "high" || parsed.detailLevel === "medium" || parsed.detailLevel === "low"
        ? parsed.detailLevel
        : inferDetailLevel(prompt);
    const ambiguityScore = clampAmbiguityScore(parsed.ambiguityScore);
    const clarificationQuestion =
      typeof parsed.clarificationQuestion === "string" && parsed.clarificationQuestion.trim()
        ? parsed.clarificationQuestion.trim()
        : "What is the main outcome and who are the key steps/actors I should include?";
    const clarificationOptions = Array.isArray(parsed.clarificationOptions)
      ? parsed.clarificationOptions.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4)
      : [];
    return {
      intentSummary: parsed.intentSummary?.trim() || prompt.slice(0, 220),
      primaryGoal: parsed.primaryGoal?.trim() || "Generate a coherent diagram from user intent",
      entities: Array.isArray(parsed.entities) ? parsed.entities.map(String).slice(0, 20) : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(String).slice(0, 30) : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships.map(String).slice(0, 30) : [],
      requestedStyle: Array.isArray(parsed.requestedStyle) ? parsed.requestedStyle.map(String).slice(0, 12) : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String).slice(0, 5) : [],
      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo.map(String).slice(0, 5) : [],
      requiredComponents: Array.isArray(parsed.requiredComponents) ? parsed.requiredComponents.map(String) : [],
      ambiguityScore,
      detailLevel,
      shouldAskClarification:
        typeof parsed.shouldAskClarification === "boolean" ? parsed.shouldAskClarification : ambiguityScore >= 75,
      clarificationQuestion,
      clarificationOptions,
      suggestedPresetId: typeof parsed.suggestedPresetId === "string" && VALID_PRESET_IDS.includes(parsed.suggestedPresetId as SocialPresetId)
        ? (parsed.suggestedPresetId as SocialPresetId)
        : null,
      suggestedDiagramType: typeof parsed.suggestedDiagramType === "string" && VALID_DIAGRAM_TYPES.includes(parsed.suggestedDiagramType as DiagramType)
        ? (parsed.suggestedDiagramType as DiagramType)
        : null,
      layoutHint: parsed.layoutHint === "graph" ? "graph" : null,
    };
  } catch {
    return { ...defaultIntentPlan(prompt), _fallback: true };
  }
}

export async function POST(req: Request) {
  const requestStart = Date.now();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    const body: ApiError = { error: "Sign in required", code: "UNAUTHORIZED" };
    return NextResponse.json(body, { status: 401 });
  }

  const { user, workspace } = await ensureUserAndWorkspace(email);

  // Workspace brand kit (optional) — when present, give the AI a palette to
  // honor for color-sensitive diagram types (echarts, mermaid theme overrides,
  // reactflow node colors).
  const brandDirective = await buildBrandDirective(workspace.id);

  // Rate limiting — fixed per user
  const rl = await rateLimit(`ai:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    const body: ApiError = { error: "Too many AI requests", code: "RATE_LIMITED", details: { retryAfter: rl.retryAfter } };
    return NextResponse.json(body, { status: 429 });
  }

  const headerKey = req.headers.get("x-openai-key");
  let apiKey: string | null = headerKey?.trim() || null;
  let skipCredits = user.plan === "pro" || Boolean(headerKey?.trim());
  /** Where the key came from — env keys are always used with the OpenAI-compatible SDK path. */
  type KeySource = "header" | "byok" | "env";
  let keySource: KeySource = "header";

  if (!apiKey) {
    const cipher = user.aiApiKeyCipher ?? null;
    if (cipher) {
      if (!isAiKeyEncryptionConfigured()) {
        const body: ApiError = {
          error:
            "A key is saved but the server is missing AI_KEY_ENCRYPTION_SECRET (min 16 chars). Add it to .env, restart, then re-save your API key in Settings.",
          code: "VALIDATION_ERROR",
        };
        return NextResponse.json(body, { status: 500 });
      }
      try {
        apiKey = decryptAiApiKey(cipher);
        skipCredits = true;
        keySource = "byok";
      } catch {
        const body: ApiError = {
          error:
            "Could not decrypt your saved API key (encryption secret may have changed). Open Settings, paste your API key again, and click Save AI settings.",
          code: "VALIDATION_ERROR",
        };
        return NextResponse.json(body, { status: 400 });
      }
    }
  }

  let detectedProvider: AiProvider | null = null;
  if (!apiKey) {
    if (process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY;
      detectedProvider = "openai";
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      detectedProvider = "google";
    } else if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
      detectedProvider = "openai";
    } else if (process.env.AI_GATEWAY_KEY) {
      apiKey = process.env.AI_GATEWAY_KEY;
      detectedProvider = "openai";
    }
    if (apiKey) keySource = "env";
  }

  if (!apiKey) {
    const body: ApiError = {
      error: "No API key configured. Add one in Settings (OpenAI, Gemini, Claude, Groq, etc.), or set OPENAI_API_KEY on the server.",
      code: "VALIDATION_ERROR",
    };
    return NextResponse.json(body, { status: 400 });
  }

  if (user.plan === "free" && !skipCredits && user.creditsBalance <= 0) {
    const body: ApiError = {
      error: "No credits left. Add an AI key in Settings, upgrade to Pro, or wait for an admin grant.",
      code: "INSUFFICIENT_CREDITS",
    };
    return NextResponse.json(body, { status: 402 });
  }

  const reqBody = (await req.json()) as {
    prompt?: string;
    diagramType?: DiagramType;
    currentSource?: string;
    conversationHistory?: ChatTurn[];
    messages?: Array<{ role?: string; content?: unknown; parts?: Array<{ type?: string; text?: string }> }>;
    diagramSummary?: string;
    title?: string;
    compact?: boolean;
    useCaseId?: UseCaseId;
    editorMode?: EditorMode;
    mode?: "patch" | "create";
  };

  const promptText = (reqBody.prompt?.trim() || lastUserText(reqBody.messages)) || undefined;

  if (!promptText) {
    const errBody: ApiError = { error: "prompt required", code: "VALIDATION_ERROR" };
    return NextResponse.json(errBody, { status: 400 });
  }

  const diagramType: DiagramType = reqBody.diagramType ?? "freeform";
  const systemPrompt = DIAGRAM_SYSTEM_PROMPTS[diagramType];
  const compact = Boolean(reqBody.compact);
  const useCaseId: UseCaseId = reqBody.useCaseId ?? "custom";
  const useCaseStyleBlock = USE_CASE_STYLE_INSTRUCTIONS[useCaseId] ?? "";
  const editorMode: EditorMode = reqBody.editorMode ?? "business";
  const modePersonaBlock = MODE_PERSONAS[editorMode] ?? "";
  // Patch mode: user is iterating on an existing diagram. Honor an explicit
  // `mode` flag, otherwise infer from whether currentSource is non-empty.
  const hasExistingSource = Boolean(reqBody.currentSource?.trim());
  const generationMode: "patch" | "create" =
    reqBody.mode === "patch" && hasExistingSource ? "patch"
    : reqBody.mode === "create" ? "create"
    : hasExistingSource ? "patch" : "create";

  console.log(`[AI generate] diagramType=${diagramType} mode=${generationMode} useCase=${useCaseId} promptLen=${promptText.length}`);

  const userProvider = (user.aiProvider ?? "google") as AiProvider;
  const provider: AiProvider = (keySource === "env" && detectedProvider) ? detectedProvider : userProvider;
  
  const googleModelFromEnv = process.env.GOOGLE_MODEL?.trim();
  const openAiModelFromEnv = process.env.OPENAI_MODEL?.trim();
  const usingOpenRouterEnvKey =
    keySource === "env" && detectedProvider === "openai" && apiKey === process.env.OPENROUTER_API_KEY;
  const openRouterModelFromEnv = process.env.OPENROUTER_MODEL?.trim();

  const model = (keySource === "env" && detectedProvider === "google")
    ? (googleModelFromEnv || "gemini-flash-latest")
    : usingOpenRouterEnvKey
    ? (openRouterModelFromEnv || "google/gemini-2.5-flash-lite")
    : (keySource === "env" && detectedProvider === "openai")
    ? (openAiModelFromEnv || "gpt-4o-mini")
    : user.aiModel?.trim() ||
      (provider === "google" ? googleModelFromEnv : undefined) ||
      (provider === "openai" ? openAiModelFromEnv : undefined) ||
      getProviderMeta(provider).defaultModel;
  const baseUrl = usingOpenRouterEnvKey
    ? "https://openrouter.ai/api/v1"
    : (keySource === "env" && detectedProvider === "openai")
    ? (process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? null)
    : (user.aiBaseUrl?.replace(/\/$/, "") ?? null);

  let languageModel;
  try {
    languageModel = buildLanguageModel(provider, model, apiKey, baseUrl);
  } catch (e) {
    const errBody: ApiError = { error: "Failed to initialize AI provider", code: "INTERNAL_ERROR", details: String(e) };
    return NextResponse.json(errBody, { status: 500 });
  }

  // Build conversation with history
  const messages: ChatTurn[] = [];
  const history = reqBody.conversationHistory?.length
    ? reqBody.conversationHistory
    : toChatTurns(reqBody.messages).slice(0, -1);
  if (history.length) {
    messages.push(...history.slice(-(compact ? 3 : 4)));
  }
  const sourceSnippet = reqBody.currentSource?.slice(0, compact ? 900 : 2200) ?? "";
  const summarySnippet = reqBody.diagramSummary?.slice(0, compact ? 280 : 560) ?? "";
  const titleSnippet = reqBody.title?.trim() ? reqBody.title.trim().slice(0, 120) : "";

  let userMessage = `Request: ${promptText}`;
  if (titleSnippet) userMessage += `\nTitle: ${titleSnippet}`;
  if (summarySnippet) userMessage += `\nCurrent diagram summary:\n${summarySnippet}`;
  if (sourceSnippet) userMessage += `\nCurrent diagram source:\n\`\`\`\n${sourceSnippet}\n\`\`\``;
  messages.push({ role: "user", content: userMessage });

  try {
    const typeHints: Record<DiagramType, string> = {
      freeform: "Extract: every distinct shape/note and its spatial relationship to the others (grouped in a frame, connected by an arrow, positioned near another element). Suggest a suggestedSubtype (sketch/spatial-map/sticky-board/mood-board).",
    };
    const intentInstruction = `You are analyzing intent for a ${diagramType} diagram. ${typeHints[diagramType]}
Return ONLY JSON matching this shape:
{
  "intentSummary": "short summary",
  "primaryGoal": "what user wants",
  "entities": ["..."],
  "steps": ["..."],
  "relationships": ["A -> B"],
  "requestedStyle": ["layout or design cues"],
  "assumptions": ["array of what you assumed"],
  "missingInfo": ["array of what critical structure is completely missing, or empty"],
  "requiredComponents": ["Button", "Card", "LineChart", "Form", "Select", "Slider", "Toggle", "DataTable"],
  "suggestedSubtype": "specific subtype recommendation if applicable",
  "ambiguityScore": 0-100,
  "detailLevel": "low|medium|high",
  "shouldAskClarification": true|false,
  "clarificationQuestion": "one concise question",
  "clarificationOptions": ["short answer option 1", "short answer option 2", "short answer option 3 (optional)"],
  "suggestedPresetId": "landscape|square_feed|story_reel|vertical_feed|link_preview|null",
  "layoutHint": "graph|null"
}
Set "layoutHint": "graph" ONLY when the request is fundamentally a connected node graph with no inherent visual composition -- a flowchart, ERD, org chart, dependency graph, or system architecture where the shapes' positions don't matter beyond "connected things read left-to-right / top-to-bottom". This lets the engine auto-arrange the nodes instead of the model guessing coordinates. Leave it null (default) for anything with deliberate visual composition -- dashboards, posters, infographics, mindmaps, timelines, or any request mentioning layout/style cues -- where hand-placed positions ARE the design.
Rules:
- Base ambiguity on missing critical nouns/actors/flow direction.
- If request is detailed, detailLevel should be high and shouldAskClarification false.
- Keep arrays compact and practical.
- Set \`shouldAskClarification: true\` ONLY when a critical actor, entity, or structure is completely absent from the prompt AND you cannot make a reasonable assumption. Most requests — even vague ones — should generate immediately with assumptions noted in \`assumptions\`. Do NOT ask for clarification if the user's intent is clear enough to produce a useful diagram. Prefer producing something and noting assumptions over blocking on questions.
- When \`shouldAskClarification\` is true, also fill \`clarificationOptions\` with 2-4 short, concrete, mutually-distinct answers the user could tap instead of typing (e.g. ["E-commerce checkout", "User onboarding", "Support ticket flow"]). Keep each option under 6 words. Leave it as an empty array only if no sensible discrete options exist.
- suggestedPresetId rules (STRICT - default to null when unsure):
  - "pitch deck", "presentation", "slides", "keynote", "16:9", "widescreen" -> "landscape"
  - "LinkedIn", "LinkedIn post", "Twitter", "X post", "Facebook post", "square", "1:1" -> "square_feed"
  - "Instagram story", "TikTok", "reel", "story", "vertical video", "9:16" -> "story_reel"
  - "Instagram feed", "portrait", "4:5" -> "vertical_feed"
  - "OG image", "link preview", "Open Graph", "social card", "blog thumbnail" -> "link_preview"
  - "README", "docs", "documentation", "diagram", "chart", "flowchart", no platform signal -> null
  - Only return a non-null value when a STRONG, EXPLICIT platform keyword is present.
  - Do NOT infer from vague style cues like "make it nice" or "for my team".${editorMode === "business" ? `
- Business-mode style check (independent of the content-ambiguity rule above): if \`requestedStyle\` gives no clear stylistic direction, set \`shouldAskClarification: true\` with a \`clarificationQuestion\` about visual style and exactly 3 \`clarificationOptions\` in this spirit — one formal/enterprise-consulting look (e.g. "Gartner-style — formal, analyst-report feel"), one bold/minimal startup look (e.g. "Startup-style — bold, minimal, modern"), and one wildcard (e.g. "Surprise me"). Skip this check (proceed to generate normally) if the user already stated a style preference anywhere in the conversation, or if this is a patch to an existing diagram rather than a first generation.` : ""}`;
    const intentStart = Date.now();
    const { text: intentText } = await generateText({
      model: languageModel,
      system: "You are a diagram intent analyzer. Extract structure from user requests accurately. Any text meant for the user (clarificationQuestion, assumptions, missingInfo) must read as plain, direct sentences: no em dashes, no filler like 'certainly' or 'delve', no hedging.",
      messages: [
        ...messages.slice(-(compact ? 3 : 4)),
        { role: "user", content: `${intentInstruction}\n\nUser prompt:\n${promptText}\n\nHistory:\n${messages.map((m) => `${m.role}: ${m.content}`).join("\n").slice(-1800)}` },
      ],
      temperature: 0.1,
      maxOutputTokens: compact ? 500 : 800,
    });
    const intentLatencyMs = Date.now() - intentStart;
    const intentPlan = parseIntentPlan(intentText, promptText);
    const shouldClarify = intentPlan.shouldAskClarification && intentPlan.ambiguityScore >= 90;
    if (shouldClarify) {
      return NextResponse.json({
        diagramType,
        source: null,
        needsClarification: true,
        assistantMessage: intentPlan.clarificationQuestion,
        clarificationOptions: intentPlan.clarificationOptions,
        assumptions: intentPlan.assumptions,
      });
    }

    // AI-suggested type switch — use a different diagram type if the intent plan recommends it
    const effectiveDiagramType: DiagramType =
      intentPlan.suggestedDiagramType && intentPlan.suggestedDiagramType !== diagramType
        ? intentPlan.suggestedDiagramType
        : diagramType;
    let finalSystemPrompt = DIAGRAM_SYSTEM_PROMPTS[effectiveDiagramType];
    if (intentPlan.requiredComponents && intentPlan.requiredComponents.length > 0) {
      finalSystemPrompt = finalSystemPrompt.replace(
        "CRITICAL RULES FOR UI NODES:",
        "CRITICAL RULES FOR UI NODES:\\n     - ONLY use these required components: " + intentPlan.requiredComponents.join(", ") + ". Do NOT use other complex components to save tokens."
      );
    }

    const baseMaxOutputTokens = 3500;
    const maxTokens = compact ? Math.max(900, Math.round(baseMaxOutputTokens * 0.7)) : baseMaxOutputTokens;

    const patchDirective = generationMode === "patch"
      ? `PATCH MODE — the user is iterating on an existing diagram. Apply ONLY the changes implied by the user's latest message. Strict rules:
- Preserve every node / actor / entity / series / shape that the user did NOT ask to remove or modify.
- Preserve all existing IDs, labels, and structural relationships unless the user explicitly asks to rename or restructure them.
- Do NOT regenerate the diagram from scratch. Do NOT switch diagram type unless the user explicitly asks.
- If the user asks to "add", insert new elements alongside the existing ones; if they ask to "remove", delete only the named element; if they ask to "rename", change only the label; if they ask to "simplify", remove only filler/leaf nodes the user wouldn't miss.
- Output the FULL new source (still emit a complete diagram), but the diff from the current source should be minimal and surgical.
`
      : "";
    const complexityDirective = buildComplexityDirective(effectiveDiagramType, {
      entities: intentPlan.entities.length,
      steps: intentPlan.steps.length,
      relationships: intentPlan.relationships.length,
      detailLevel: intentPlan.detailLevel,
    });
    const generationInstruction = `${brandDirective}${patchDirective}${complexityDirective}Intent plan:
${JSON.stringify(intentPlan, null, 2)}
${(intentPlan as { suggestedSubtype?: string }).suggestedSubtype ? `\nUse diagram subtype: ${(intentPlan as { suggestedSubtype?: string }).suggestedSubtype}` : ""}
Quality requirements:
- Build a coherent structure, never random nodes.
- Ensure clear start and end when applicable.
- Label edges with intent verbs for flow diagrams.
- Use balanced spacing and avoid overlapping/orphaned nodes.
- Detail scaling: low=compact but complete, medium=moderate branching, high=rich sub-steps and annotations.
- If assumptions are used, encode them conservatively in the diagram content.${useCaseStyleBlock ? `\n${useCaseStyleBlock}` : ""}${modePersonaBlock ? `\n${modePersonaBlock}` : ""}
${ANTI_GENERIC_DIRECTIVE}`;

    const typeSwitched = effectiveDiagramType !== diagramType;
    const switchedTypeLabel = typeSwitched ? getDiagramTypeMeta(effectiveDiagramType).label : null;
    const assumptionNote = typeSwitched
      ? `Switched to ${switchedTypeLabel}, a better fit for your prompt.${intentPlan.assumptions.length > 0 ? ` Assumptions: ${intentPlan.assumptions.slice(0, 2).join("; ")}.` : ""}`
      : generationMode === "patch"
        ? `Patched existing diagram${intentPlan.assumptions.length > 0 ? `. Assumptions: ${intentPlan.assumptions.slice(0, 2).join("; ")}.` : "."}`
        : intentPlan.assumptions.length > 0
          ? `Assumptions used: ${intentPlan.assumptions.slice(0, 3).join("; ")}.`
          : "Updated with explicit structure from your request.";

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
        writer.write({
          type: "data-meta",
          data: {
            diagramType: effectiveDiagramType,
            needsClarification: false,
            assumptions: intentPlan.assumptions,
            missingInfo: intentPlan.missingInfo,
            assistantMessage: assumptionNote,
            detailLevel: intentPlan.detailLevel,
            resolvedSubtype:
              (intentPlan as { suggestedSubtype?: string }).suggestedSubtype ?? effectiveDiagramType,
            typeSwitched,
            suggestedPresetId: intentPlan.suggestedPresetId ?? null,
            intentFallback: Boolean(intentPlan._fallback),
            generationMode,
          },
        });

        const genStart = Date.now();

        // Real progress events tied to the actual phases below, reconciled on the
        // client by a stable id (writing the same id again updates the same row
        // instead of appending a new one) — replaces a client-side hardcoded
        // "Analyzing... Planning... Streaming..." list that didn't track what the
        // server was actually doing.
        const writeProgress = (step: string, label: string, status: "active" | "done" | "error") =>
          writer.write({ type: "data-progress", id: "progress", data: { step, label, status } });

        writeProgress("generate", "Generating diagram…", "active");

        // Reserve the credit atomically BEFORE generation. Charging afterwards
        // let concurrent requests all pass the up-front gate and get charged
        // once collectively. tryDecrementCredit only succeeds if balance > 0, so
        // losing the race here means there genuinely was no credit left.
        let creditReserved = false;
        if (user.plan === "free" && !skipCredits) {
          creditReserved = await tryDecrementCredit(user.id);
          if (!creditReserved) {
            writeProgress("generate", "No credits left", "error");
            writer.write({
              type: "data-meta",
              data: {
                error: "No credits left. Add an AI key in Settings, upgrade to Pro, or wait for an admin grant.",
                code: "INSUFFICIENT_CREDITS",
              },
            });
            return;
          }
        }

        const result = streamText({
          model: languageModel,
          system: `${finalSystemPrompt}\n\n${generationInstruction}`,
          messages,
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
        });

        writer.merge(result.toUIMessageStream());

        let validationStatus: "ok" | "repaired" | "failed_after_retry" | "error" = "ok";
        let retryAttempted = false;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;
        let genLatencyMs: number | undefined;
        let errorMessage: string | undefined;

        try {
          const finalText = await result.text;
          genLatencyMs = Date.now() - genStart;
          try {
            const usage = await result.usage;
            inputTokens = usage?.inputTokens;
            outputTokens = usage?.outputTokens;
          } catch {}

          writeProgress("validate", "Checking output…", "active");
          const validation = await validateAndRepairOutput(effectiveDiagramType, finalText);
          console.log(`[AI generate] validation ${validation.ok ? "ok" : "FAILED"} type=${effectiveDiagramType} latencyMs=${genLatencyMs} outputLen=${finalText.length}${validation.ok ? "" : ` reason=${validation.reason}`}`);
          if (validation.ok) writeProgress("done", "Diagram ready", "done");

          // The model still emits raw x/y for freeform docs -- graph-shaped
          // requests (flowchart/ERD/org-chart) come back with crossing edges
          // and colliding labels even when every shape and connection is
          // correct, because pixel placement is not what LLMs are good at.
          // Re-run the SAME layered graph layout the "Tidy Up" button uses,
          // but only when the intent pass flagged this as a graph (never on
          // patches -- that would blow away hand-edited positions -- and
          // never on poster/dashboard compositions, where position is the
          // design, not incidental).
          let layoutApplied = false;
          let layoutedSource: string | undefined;
          if (
            validation.ok &&
            generationMode === "create" &&
            effectiveDiagramType === "freeform"
          ) {
            try {
              const parsedDoc = JSON.parse(validation.source);
              if (intentPlan.layoutHint === "graph") {
                const laidOut = autoLayoutFreeformDocument(parsedDoc);
                layoutedSource = JSON.stringify(laidOut);
                layoutApplied = true;
              } else {
                const repaired = repairOverlaps(parsedDoc);
                if (repaired !== parsedDoc) {
                  layoutedSource = JSON.stringify(repaired);
                  layoutApplied = true;
                }
              }
            } catch (err) {
              console.warn(`[AI generate] auto-layout skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          // Deterministic, authored follow-up suggestions computed against the
          // actual final source (not model-generated, not predicted blind before
          // generation) — see packages/core/src/followups.ts.
          writer.write({
            type: "data-meta",
            data: {
              suggestedFollowUps: getFollowUpSuggestions(
                effectiveDiagramType,
                validation.ok ? validation.source : finalText
              ),
              ...(layoutApplied ? { layoutApplied: true, correctedSource: layoutedSource } : {}),
            },
          });

          if (!validation.ok) {
            retryAttempted = true;
            writeProgress("repair", "Fixing an issue…", "active");
            const correctiveInstruction = `Your previous ${effectiveDiagramType} output failed validation: ${validation.reason}

Return ONLY the corrected ${effectiveDiagramType} source. No prose, no explanation, no markdown fences. Preserve the intent and structure of your previous attempt; fix only what is broken.`;

            try {
              const corrective = await generateText({
                model: languageModel,
                system: finalSystemPrompt,
                messages: [
                  ...messages,
                  { role: "assistant", content: finalText },
                  { role: "user", content: correctiveInstruction },
                ],
                temperature: 0.1,
                maxOutputTokens: maxTokens,
                abortSignal: AbortSignal.timeout(CORRECTIVE_TIMEOUT_MS),
              });
              const recheck = await validateAndRepairOutput(effectiveDiagramType, corrective.text);
              if (recheck.ok) {
                validationStatus = "repaired";
                writeProgress("done", "Diagram ready", "done");
                writer.write({
                  type: "data-meta",
                  data: {
                    correctedSource: recheck.source,
                    validationRepaired: true,
                    validationReason: validation.reason,
                  },
                });
              } else {
                validationStatus = "failed_after_retry";
                console.warn("[AI generate] Corrective pass also failed:", recheck.reason);
                writeProgress("repair", "Couldn't fully fix the output", "error");
                writer.write({
                  type: "data-meta",
                  data: {
                    validationFailed: true,
                    validationReason: validation.reason,
                  },
                });
              }
            } catch (e) {
              validationStatus = "failed_after_retry";
              console.warn("[AI generate] Corrective pass errored:", e);
              writeProgress("repair", "Couldn't fully fix the output", "error");
              writer.write({
                type: "data-meta",
                data: {
                  validationFailed: true,
                  validationReason: validation.reason,
                },
              });
            }
          }

        } catch (e) {
          validationStatus = "error";
          errorMessage = e instanceof Error ? e.message : String(e);
          console.error("[AI generate] post-stream error:", e);
          writeProgress("generate", "Generation failed", "error");
          // Generation never produced usable output — give the reserved credit back.
          if (creditReserved) {
            await refundCredit(user.id);
            creditReserved = false;
          }
        }

        void recordAiEvent({
          userId: user.id,
          diagramType,
          effectiveDiagramType,
          typeSwitched,
          mode: generationMode,
          provider,
          model,
          promptLength: promptText.length,
          sourceLength: sourceSnippet.length,
          intentLatencyMs,
          genLatencyMs,
          totalLatencyMs: Date.now() - requestStart,
          inputTokens,
          outputTokens,
          validationStatus,
          retryAttempted,
          intentFallback: Boolean(intentPlan._fallback),
          error: errorMessage ?? null,
        });
      },
      }),
    });
  } catch (e) {
    console.error("[AI generate error]", e);
    const errBody: ApiError = { error: e instanceof Error ? e.message : "AI generation failed", code: "INTERNAL_ERROR" };
    return NextResponse.json(errBody, { status: 502 });
  }
}

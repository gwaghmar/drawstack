import { NextResponse } from "next/server";
import { generateText } from "ai";
import { buildLanguageModel } from "@/lib/ai-providers";
import { validateAndRepairOutput } from "@/lib/diagrams/validate-output";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import sharp from "sharp";
import { getHostedAiConfig } from "@/lib/hosted-ai";

export const maxDuration = 60;
const MAX_IMAGE_DATA_LENGTH = 8_000_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_IMAGE_BYTES = 6_000_000;
const MAX_IMAGE_PIXELS = 40_000_000;

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

const VISION_SYSTEM_PROMPT = `You are an expert system architect and visual diagram engineer.
Analyze the provided image (whiteboard photo, architecture diagram, flowchart, mindmap, UI sketch, or process chart) and reconstruct it with high fidelity as a Freeform Canvas JSON document.

Output ONLY valid JSON matching this schema:
{
  "version": 1,
  "renderMode": "clean",
  "shapes": [
    {
      "id": "unique-id",
      "type": "rectangle" | "diamond" | "ellipse" | "triangle" | "cylinder" | "cloud" | "hexagon" | "star" | "sticky" | "text" | "frame",
      "name": "semantic-name",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "fill": "1" | "2" | "3" | "4" | "5" | "6" | "transparent" | "#ffffff",
      "stroke": "#1e293b",
      "strokeWidth": 2,
      "text": { "content": "Label", "fontSize": 13, "bold": true, "align": "center" }
    },
    {
      "id": "arrow-id",
      "type": "arrow",
      "x": 0,
      "y": 0,
      "start": { "shapeId": "source-id", "anchor": "top"|"bottom"|"left"|"right"|"center"|"auto" },
      "end": { "shapeId": "target-id", "anchor": "top"|"bottom"|"left"|"right"|"center"|"auto" },
      "routing": "straight" | "orthogonal",
      "label": "optional label"
    }
  ]
}

Rules:
1. Palette shorthand for fills: "1"=cyan/sky, "2"=red/rose, "3"=amber/gold, "4"=green/emerald, "5"=blue/indigo, "6"=purple/violet.
2. Use "cylinder" for databases/storage, "diamond" for decisions, "cloud" for external SaaS/APIs, "rectangle" for services/steps.
3. Coordinates: space nodes neatly so arrows do not overlap unnecessarily.
4. Output raw JSON only with no markdown fences.`;

export async function POST(req: Request) {
  let reservedCreditFor: string | null = null;
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { user } = await ensureUserAndWorkspace(email);
    const limit = await rateLimit(`vision:${user.id}`, 10, 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = await req.json() as { image?: unknown; prompt?: unknown };
    const { image, prompt: userPrompt } = body;

    if (!image || typeof image !== "string" || image.length > MAX_IMAGE_DATA_LENGTH) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }
    if (userPrompt !== undefined && (typeof userPrompt !== "string" || userPrompt.length > MAX_PROMPT_LENGTH)) {
      return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });
    }
    const imageMatch = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!imageMatch) {
      return NextResponse.json({ error: "Use a PNG, JPEG, or WebP data URL" }, { status: 400 });
    }
    const imageBytes = Buffer.from(imageMatch[2], "base64");
    if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 413 });
    }
    try {
      const metadata = await sharp(imageBytes, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
      if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format ?? "")) {
        return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid or oversized image data" }, { status: 400 });
    }

    const hostedAi = getHostedAiConfig();
    if (!hostedAi) {
      return NextResponse.json({ error: "Hosted AI is temporarily unavailable" }, { status: 503 });
    }
    const model = buildLanguageModel(hostedAi.provider, hostedAi.model, hostedAi.apiKey, hostedAi.baseUrl);

    if (user.plan === "free") {
      if (!(await takeCredit(user.id))) {
        return NextResponse.json({ error: "No credits left" }, { status: 402 });
      }
      reservedCreditFor = user.id;
    }

    const startTime = Date.now();
    const result = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: VISION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt || "Extract and convert this diagram into a complete Freeform Canvas JSON document.",
            },
            {
              type: "image",
              image: new URL(image),
            },
          ],
        },
      ],
    });

    const rawOutput = result.text.trim();
    const validation = await validateAndRepairOutput("freeform", rawOutput);

    return NextResponse.json({
      success: validation.ok,
      doc: validation.ok ? JSON.parse(validation.source) : null,
      source: validation.ok ? validation.source : rawOutput,
      usage: result.usage,
      latencyMs: Date.now() - startTime,
    });
  } catch (err: any) {
    if (reservedCreditFor) await refundCredit(reservedCreditFor);
    return NextResponse.json(
      { error: err.message || "Vision extraction failed" },
      { status: 500 }
    );
  }
}

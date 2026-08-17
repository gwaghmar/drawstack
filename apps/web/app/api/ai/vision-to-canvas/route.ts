import { NextResponse } from "next/server";
import { generateText } from "ai";
import { buildLanguageModel } from "@/lib/ai-providers";
import { validateAndRepairOutput } from "@/lib/diagrams/validate-output";

export const maxDuration = 60;

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
  try {
    const body = await req.json();
    const { image, prompt: userPrompt } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      "";
    const provider = process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google" : "openai";
    const modelId = provider === "google" ? "gemini-flash-latest" : "gpt-4o-mini";

    const model = buildLanguageModel(provider, modelId, apiKey);

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
              image: image.startsWith("data:") ? new URL(image) : image,
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
    return NextResponse.json(
      { error: err.message || "Vision extraction failed" },
      { status: 500 }
    );
  }
}

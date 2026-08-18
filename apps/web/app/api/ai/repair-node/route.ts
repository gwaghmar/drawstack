import { generateText } from "ai";
import { buildLanguageModel } from "@/lib/ai-providers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are an expert React developer. The user has provided some React code that is currently throwing a runtime error when executed. 
Your task is to fix the error and return ONLY the corrected React code.

RULES:
- DO NOT wrap the code in markdown blocks (e.g. \`\`\`tsx).
- DO NOT include any explanations.
- DO NOT import React or any components; they are already in scope.
- Return ONLY the raw code string that exports a default component.`;

export async function POST(req: NextRequest) {
  try {
    const { code, error } = await req.json();

    const result = await generateText({
      model: buildLanguageModel("openai", "gpt-4o-mini", process.env.OPENAI_API_KEY || "ollama"),
      system: SYSTEM_PROMPT,
      prompt: `Fix this code:\n\n${code}\n\nError:\n${error}`,
      temperature: 0.1,
    });

    // Clean up potential markdown blocks if the model ignores the instruction
    let fixedCode = result.text.trim();
    if (fixedCode.startsWith("\`\`\`")) {
      fixedCode = fixedCode.replace(/^\`\`\`(tsx|jsx|js|ts)?\n/, "").replace(/\n\`\`\`$/, "");
    }

    return NextResponse.json({ code: fixedCode });
  } catch (e: any) {
    console.error("Repair failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

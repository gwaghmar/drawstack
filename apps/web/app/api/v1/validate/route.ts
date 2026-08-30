import { NextResponse } from "next/server";
import { type ApiError } from "@flowchart/core";
import { rateLimit } from "@/lib/rate-limit";
import { getPrincipalFromRequest } from "@/lib/api-auth";
import { parseFreeformSource, validateFreeformRefs } from "@/lib/diagrams/freeform-canvas";

const MAX_SOURCE_LENGTH = 500_000;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const principal = await getPrincipalFromRequest(req);
  const rlKey =
    principal.type === "user" ? `validate:key:${principal.userId}` : `validate:ip:${ip}`;
  const rl = await rateLimit(rlKey, principal.type === "user" ? 600 : 60, 60_000);
  if (!rl.ok) {
    const body: ApiError = {
      error: "Too many requests",
      code: "RATE_LIMITED",
      details: { retryAfter: rl.retryAfter },
    };
    return NextResponse.json(body, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  try {
    const json = await req.json() as { source?: unknown };
    if (typeof json.source !== "string" || json.source.length === 0 || json.source.length > MAX_SOURCE_LENGTH) {
      throw new Error("Diagram source must be a non-empty string no larger than 500 KB");
    }
    const parsed = parseFreeformSource(json.source);
    const issues = [...parsed.errors, ...validateFreeformRefs(parsed.doc)];
    if (issues.length > 0) {
      return NextResponse.json({ ok: false, issues }, { status: 400 });
    }
    return NextResponse.json({ ok: true, length: json.source.length, shapeCount: parsed.doc.shapes.length });
  } catch (e) {
    const body: ApiError = {
      error: e instanceof Error ? e.message : "Invalid body",
      code: "VALIDATION_ERROR",
    };
    return NextResponse.json(body, { status: 400 });
  }
}

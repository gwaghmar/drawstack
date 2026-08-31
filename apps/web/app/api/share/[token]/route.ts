import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, shareLinks } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { parseSharedEngineV3Document } from "@/lib/engine-v3/shared-document";
import { serializeEngineV3Document } from "@/lib/engine-v3/serialization";
import { referencedEngineV3AssetIds } from "@/lib/engine-v3/asset-sharing";

function withShareAssetSources(source: string, diagramType: string, token: string): string {
  const document = parseSharedEngineV3Document(diagramType, source);
  if (!document) return source;
  const next = structuredClone(document);
  for (const id of referencedEngineV3AssetIds(next)) if (next.assets[id]) next.assets[id].source = `/api/share/${encodeURIComponent(token)}/assets/${id}`;
  return serializeEngineV3Document(next);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = await rateLimit(`share:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const { token } = await params;
  const tokenHash = sha256Hex(token);
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash))
    .limit(1);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
  }

  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, link.projectId))
    .limit(1);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    { id: p.id, title: p.title, source: withShareAssetSources(p.source, p.diagramType, token), themeId: p.themeId, diagramType: p.diagramType },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

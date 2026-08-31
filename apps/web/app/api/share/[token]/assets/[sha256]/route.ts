import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, shareLinks, users, workspaces } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { parseSharedEngineV3Document } from "@/lib/engine-v3/shared-document";
import { runtimeAssetStorage } from "@/lib/engine-v3/runtime-asset-storage";
import type { EngineNode } from "@/lib/engine-v3/document";
import { isSharedInlineImageMime } from "@/lib/engine-v3/asset-sharing";

const SHA256 = /^[a-f0-9]{64}$/;

export async function GET(request: Request, { params }: { params: Promise<{ token: string; sha256: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limited = await rateLimit(`share-asset:${ip}`, 240, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { token, sha256 } = await params;
  if (!SHA256.test(sha256)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [record] = await db.select({
    source: projects.source,
    diagramType: projects.diagramType,
    ownerEmail: users.email,
    expiresAt: shareLinks.expiresAt,
  }).from(shareLinks)
    .innerJoin(projects, eq(projects.id, shareLinks.projectId))
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .innerJoin(users, eq(users.id, workspaces.ownerId))
    .where(and(eq(shareLinks.tokenHash, sha256Hex(token)), eq(projects.id, shareLinks.projectId)))
    .limit(1);

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.expiresAt && record.expiresAt < new Date()) return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
  const document = parseSharedEngineV3Document(record.diagramType, record.source);
  if (!document || !document.assets[sha256]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const referenced = document.pages.some((page) => {
    const visit = (node: EngineNode): boolean => node.assetRef === sha256 || (node.type === "frame" && node.children.some(visit));
    return visit(page.root);
  });
  if (!referenced) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored = await runtimeAssetStorage().get(record.ownerEmail, sha256);
  if (!stored) return NextResponse.json({ error: "Asset unavailable" }, { status: 404 });
  if (!isSharedInlineImageMime(stored.asset.mime)) return NextResponse.json({ error: "Asset type unavailable" }, { status: 404 });
  return new NextResponse(stored.content.buffer.slice(stored.content.byteOffset, stored.content.byteOffset + stored.content.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": stored.asset.mime,
      "Content-Length": String(stored.content.byteLength),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}

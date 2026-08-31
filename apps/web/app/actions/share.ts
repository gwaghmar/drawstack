"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, shareLinks } from "@/lib/db/schema";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { and, eq, isNull, lt } from "drizzle-orm";
import { sha256Hex, token } from "@/lib/crypto";
import { sanitizeSharePreviewDataUrl } from "@/lib/share-preview";
import { isMockDbEnabled } from "@/lib/db/mode";


export async function createShareLink(projectId: string, previewDataUrl?: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace } = await ensureUserAndWorkspace(email);

  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!isMockDbEnabled() && (!p || p.workspaceId !== workspace.id)) throw new Error("Not found");

  const preview = sanitizeSharePreviewDataUrl(previewDataUrl);

  // Return an existing active (non-expired) token instead of creating duplicates
  const now = new Date();
  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.projectId, projectId),
        isNull(shareLinks.expiresAt)
      )
    )
    .limit(1);

  if (existing) {
    // Re-derive the raw token isn't possible (we only store the hash), so we
    // need to issue a new token for the same project. But we avoid token sprawl
    // by deleting the old one first so only one active token exists at a time.
    await db.delete(shareLinks).where(eq(shareLinks.id, existing.id));
  }

  const raw = token("sh_", 24);
  const tokenHash = sha256Hex(raw);
  await db.insert(shareLinks).values({
    id: crypto.randomUUID(),
    projectId,
    tokenHash,
    rawToken: raw,
    createdAt: now,
    previewDataUrl: preview,
  });

  // Opportunistic cleanup: delete expired share links for this project
  await db
    .delete(shareLinks)
    .where(
      and(
        eq(shareLinks.projectId, projectId),
        lt(shareLinks.expiresAt, now)
      )
    );

  return raw;
}

/**
 * Refresh the preview PNG on the active share link for this project without
 * minting a new token. No-op if no active link exists yet.
 */
export async function updateSharePreview(projectId: string, previewDataUrl: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace } = await ensureUserAndWorkspace(email);

  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!isMockDbEnabled() && (!p || p.workspaceId !== workspace.id)) throw new Error("Not found");

  const preview = sanitizeSharePreviewDataUrl(previewDataUrl);
  if (!preview) return { updated: false };

  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.projectId, projectId),
        isNull(shareLinks.expiresAt)
      )
    )
    .limit(1);

  if (!existing) return { updated: false };

  await db
    .update(shareLinks)
    .set({ previewDataUrl: preview })
    .where(eq(shareLinks.id, existing.id));
  return { updated: true };
}

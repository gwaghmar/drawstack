"use server";

import { auth } from "@/auth";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { db } from "@/lib/db";
import { projects, revisions } from "@/lib/db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { DiagramType } from "@flowchart/core";
import { isMockDbEnabled } from "@/lib/db/mode";

export async function listProjects() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return [];
  const { workspace } = await ensureUserAndWorkspace(email);
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspace.id))
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(
  title: string,
  source: string,
  themeId: string,
  diagramType: DiagramType = "freeform"
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace } = await ensureUserAndWorkspace(email);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(projects).values({
    id,
    workspaceId: workspace.id,
    title,
    source,
    themeId,
    diagramType,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    projectId: id,
    source,
    label: "Initial",
    createdAt: now,
  });
  revalidatePath("/app");
  return id;
}

export async function saveProject(
  id: string,
  patch: { source?: string; themeId?: string; title?: string; diagramType?: DiagramType },
  revisionLabel?: string
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace, user } = await ensureUserAndWorkspace(email);
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!isMockDbEnabled() && (!p || p.workspaceId !== workspace.id)) throw new Error("Not found");
  const now = new Date();
  await db
    .update(projects)
    .set({ ...patch, updatedAt: now })
    .where(eq(projects.id, id));
  if (patch.source) {
    await db.insert(revisions).values({
      id: crypto.randomUUID(),
      projectId: id,
      source: patch.source,
      label: revisionLabel ?? "Manual edit",
      createdAt: now,
      createdBy: user.id,
    });
    // Prune: keep only the 50 most recent revisions for this project
    const kept = await db
      .select({ id: revisions.id, createdAt: revisions.createdAt })
      .from(revisions)
      .where(eq(revisions.projectId, id))
      .orderBy(desc(revisions.createdAt))
      .limit(50);
    if (kept.length === 50) {
      const oldestKept = kept[kept.length - 1];
      await db
        .delete(revisions)
        .where(
          and(
            eq(revisions.projectId, id),
            lt(revisions.createdAt, oldestKept.createdAt)
          )
        );
    }
  }
  revalidatePath("/app");
  revalidatePath(`/app/editor`);
}

export async function listRevisions(projectId: string, limit = 50) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return [];
  const { workspace } = await ensureUserAndWorkspace(email);
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!p || p.workspaceId !== workspace.id) return [];
  const rows = await db
    .select({
      id: revisions.id,
      label: revisions.label,
      createdAt: revisions.createdAt,
    })
    .from(revisions)
    .where(eq(revisions.projectId, projectId))
    .orderBy(desc(revisions.createdAt))
    .limit(limit);
  return rows;
}

export async function restoreRevision(projectId: string, revisionId: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace, user } = await ensureUserAndWorkspace(email);
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!p || p.workspaceId !== workspace.id) throw new Error("Not found");
  const [rev] = await db
    .select()
    .from(revisions)
    .where(eq(revisions.id, revisionId))
    .limit(1);
  if (!rev || rev.projectId !== projectId) throw new Error("Revision not found");
  const now = new Date();
  await db
    .update(projects)
    .set({ source: rev.source, updatedAt: now })
    .where(eq(projects.id, projectId));
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    projectId,
    source: rev.source,
    label: `Restored revision from ${rev.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
    createdAt: now,
    createdBy: user.id,
  });
  revalidatePath(`/app/editor`);
  return { source: rev.source };
}

export async function deleteProject(id: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { workspace } = await ensureUserAndWorkspace(email);
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!p || p.workspaceId !== workspace.id) throw new Error("Not found");
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/app");
}

export async function getProject(id: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const { workspace } = await ensureUserAndWorkspace(email);
  const [p] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!p || p.workspaceId !== workspace.id) return null;
  return p;
}

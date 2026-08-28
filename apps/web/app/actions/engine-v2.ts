"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, revisions } from "@/lib/db/schema";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";
import { revisionIdsBeyondLimit } from "@/lib/engine-v2/revision-retention";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function validSource(source: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Document is not valid JSON");
  }
  const result = validateEngineV2Document(parsed);
  if (!result.ok) throw new Error(result.issues[0]?.message || "Invalid Engine v2 document");
  return JSON.stringify(result.document);
}

async function engineContext() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  return ensureUserAndWorkspace(email);
}

async function pruneEngineV2Revisions(projectId: string) {
  const ordered = await db.select({ id: revisions.id }).from(revisions)
    .where(eq(revisions.projectId, projectId))
    .orderBy(desc(revisions.createdAt), desc(revisions.id));
  const staleIds = revisionIdsBeyondLimit(ordered, 50);
  if (staleIds.length) {
    await db.delete(revisions).where(and(eq(revisions.projectId, projectId), inArray(revisions.id, staleIds)));
  }
}

export async function createEngineV2Project(title: string, source: string) {
  const { workspace, user } = await engineContext();
  const normalized = validSource(source);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(projects).values({
    id,
    workspaceId: workspace.id,
    title: title.trim().slice(0, 120) || "Untitled Engine v2 document",
    source: normalized,
    themeId: "dom-css-v2",
    diagramType: "engine-v2",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    projectId: id,
    source: normalized,
    label: "Initial",
    createdAt: now,
    createdBy: user.id,
  });
  revalidatePath("/app");
  return id;
}

export async function saveEngineV2Project(id: string, title: string, source: string, label = "Manual edit") {
  const { workspace, user } = await engineContext();
  const normalized = validSource(source);
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project || project.workspaceId !== workspace.id || project.diagramType !== "engine-v2") throw new Error("Project not found");
  const now = new Date();
  await db.update(projects).set({ title: title.trim().slice(0, 120) || project.title, source: normalized, updatedAt: now }).where(eq(projects.id, id));
  await db.insert(revisions).values({ id: crypto.randomUUID(), projectId: id, source: normalized, label, createdAt: now, createdBy: user.id });
  await pruneEngineV2Revisions(id);
  revalidatePath("/app");
}

export async function listEngineV2Revisions(projectId: string) {
  const { workspace } = await engineContext();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.workspaceId !== workspace.id || project.diagramType !== "engine-v2") return [];
  return db.select({ id: revisions.id, label: revisions.label, createdAt: revisions.createdAt })
    .from(revisions).where(eq(revisions.projectId, projectId)).orderBy(desc(revisions.createdAt)).limit(50);
}

export async function restoreEngineV2Revision(projectId: string, revisionId: string) {
  const { workspace, user } = await engineContext();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.workspaceId !== workspace.id || project.diagramType !== "engine-v2") throw new Error("Project not found");
  const [revision] = await db.select().from(revisions).where(and(eq(revisions.id, revisionId), eq(revisions.projectId, projectId))).limit(1);
  if (!revision) throw new Error("Revision not found");
  const source = validSource(revision.source);
  const now = new Date();
  await db.update(projects).set({ source, updatedAt: now }).where(eq(projects.id, projectId));
  await db.insert(revisions).values({ id: crypto.randomUUID(), projectId, source, label: "Restored revision", createdAt: now, createdBy: user.id });
  await pruneEngineV2Revisions(projectId);
  return source;
}

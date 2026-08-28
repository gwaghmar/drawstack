"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projectCollaborators, projects, revisions } from "@/lib/db/schema";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";
import { hasEngineV2VersionConflict, nextEngineV2UpdatedAt, type EngineV2RestoreResult, type EngineV2SaveResult } from "@/lib/engine-v2/persistence";
import { revisionIdsBeyondLimit } from "@/lib/engine-v2/revision-retention";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { canEditProject, resolveProjectAccess } from "@/lib/project-access";
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

async function editableEngineProject(id: string) {
  const { workspace, user } = await engineContext();
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project || project.diagramType !== "engine-v2") throw new Error("Project not found");
  const [collaborator] = project.workspaceId === workspace.id ? [] : await db.select({ role: projectCollaborators.role })
    .from(projectCollaborators)
    .where(and(eq(projectCollaborators.projectId, id), eq(projectCollaborators.userId, user.id)))
    .limit(1);
  const access = resolveProjectAccess(project.workspaceId, workspace.id, collaborator?.role);
  if (!canEditProject(access)) throw new Error("Project not found");
  return { project, user };
}

export async function getEditableEngineV2Project(id: string) {
  try {
    return (await editableEngineProject(id)).project;
  } catch {
    return null;
  }
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
  return { id, updatedAt: now.toISOString() };
}

export async function saveEngineV2Project(
  id: string,
  title: string,
  source: string,
  expectedUpdatedAt: string,
  label = "Manual edit",
): Promise<EngineV2SaveResult> {
  const { project, user } = await editableEngineProject(id);
  const normalized = validSource(source);
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) throw new Error("Invalid project version");
  if (hasEngineV2VersionConflict(expectedUpdatedAt, project.updatedAt)) {
    return { ok: false, reason: "conflict", updatedAt: project.updatedAt.toISOString() };
  }
  const now = nextEngineV2UpdatedAt(project.updatedAt);
  const updated = await db.update(projects)
    .set({ title: title.trim().slice(0, 120) || project.title, source: normalized, updatedAt: now })
    .where(and(eq(projects.id, id), eq(projects.updatedAt, expected)))
    .returning({ updatedAt: projects.updatedAt });
  if (!updated.length) {
    const [latest] = await db.select({ updatedAt: projects.updatedAt }).from(projects).where(eq(projects.id, id)).limit(1);
    return { ok: false, reason: "conflict", updatedAt: (latest?.updatedAt ?? project.updatedAt).toISOString() };
  }
  await db.insert(revisions).values({ id: crypto.randomUUID(), projectId: id, source: normalized, label, createdAt: now, createdBy: user.id });
  await pruneEngineV2Revisions(id);
  revalidatePath("/app");
  return { ok: true, updatedAt: updated[0].updatedAt.toISOString() };
}

export async function listEngineV2Revisions(projectId: string) {
  try {
    await editableEngineProject(projectId);
  } catch {
    return [];
  }
  return db.select({ id: revisions.id, label: revisions.label, createdAt: revisions.createdAt })
    .from(revisions).where(eq(revisions.projectId, projectId)).orderBy(desc(revisions.createdAt)).limit(50);
}

export async function restoreEngineV2Revision(
  projectId: string,
  revisionId: string,
  expectedUpdatedAt: string,
): Promise<EngineV2RestoreResult> {
  const { project, user } = await editableEngineProject(projectId);
  const [revision] = await db.select().from(revisions).where(and(eq(revisions.id, revisionId), eq(revisions.projectId, projectId))).limit(1);
  if (!revision) throw new Error("Revision not found");
  const source = validSource(revision.source);
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) throw new Error("Invalid project version");
  if (hasEngineV2VersionConflict(expectedUpdatedAt, project.updatedAt)) {
    return { ok: false, reason: "conflict", updatedAt: project.updatedAt.toISOString() };
  }
  const now = nextEngineV2UpdatedAt(project.updatedAt);
  const updated = await db.update(projects)
    .set({ source, updatedAt: now })
    .where(and(eq(projects.id, projectId), eq(projects.updatedAt, expected)))
    .returning({ updatedAt: projects.updatedAt });
  if (!updated.length) {
    const [latest] = await db.select({ updatedAt: projects.updatedAt }).from(projects).where(eq(projects.id, projectId)).limit(1);
    return { ok: false, reason: "conflict", updatedAt: (latest?.updatedAt ?? project.updatedAt).toISOString() };
  }
  await db.insert(revisions).values({ id: crypto.randomUUID(), projectId, source, label: "Restored revision", createdAt: now, createdBy: user.id });
  await pruneEngineV2Revisions(projectId);
  return { ok: true, source, updatedAt: updated[0].updatedAt.toISOString() };
}

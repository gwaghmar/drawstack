"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  projectCollaborators,
  projectEdits,
  collaboratorPresence,
  projects,
  users,
} from "@/lib/db/schema";
import {
  canEditProject,
  canManageProject,
  canReadProject,
  resolveProjectAccess,
  type ProjectAccess,
} from "@/lib/project-access";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { engineTransactionRecordId, parseEngineTransactionEnvelope, type EngineEditCursor, type EngineTransactionEnvelope, type EngineTransactionRecord } from "@/lib/engine-v2/collaboration";
import { parseEngineV3CommandEnvelope } from "@/lib/engine-v3/collaboration-envelope";
import type { EngineV3CommandEnvelope } from "@/lib/engine-v3/commands";
import { asc, eq, and, gt, or } from "drizzle-orm";

async function getProjectAccess(projectId: string): Promise<{
  access: ProjectAccess;
  userId: string;
} | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const { user, workspace } = await ensureUserAndWorkspace(email);
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return null;

  const collaborator = project.workspaceId === workspace.id
    ? null
    : await db.query.projectCollaborators.findFirst({
      where: and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, user.id),
      ),
    });

  return {
    access: resolveProjectAccess(project.workspaceId, workspace.id, collaborator?.role),
    userId: user.id,
  };
}

export async function addCollaborator(
  projectId: string,
  email: string,
  role: "viewer" | "editor" | "admin" = "editor"
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canManageProject(context.access)) {
      return { success: false, error: "Only workspace owner can add collaborators" };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) return { success: false, error: "User not found" };

    await db.insert(projectCollaborators).values({
      projectId,
      userId: user.id,
      role,
    });

    return { success: true };
  } catch (err) {
    console.error("[addCollaborator]", err);
    return { success: false, error: "Failed to add collaborator" };
  }
}

export async function removeCollaborator(
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canManageProject(context.access)) {
      return { success: false, error: "Only workspace owner can remove collaborators" };
    }

    await db
      .delete(projectCollaborators)
      .where(
        and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId))
      );

    return { success: true };
  } catch (err) {
    console.error("[removeCollaborator]", err);
    return { success: false, error: "Failed to remove collaborator" };
  }
}

export async function recordEdit(
  projectId: string,
  operation: string,
  operationData: string,
  clientId: string,
  lamportTimestamp: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canEditProject(context.access)) {
      return { success: false, error: "Editor access required" };
    }

    await db.insert(projectEdits).values({
      projectId,
      userId: context.userId,
      operation,
      operationData,
      clientId,
      lamportTimestamp,
    });

    return { success: true };
  } catch (err) {
    console.error("[recordEdit]", err);
    return { success: false, error: "Failed to record edit" };
  }
}

export async function updatePresence(
  projectId: string,
  sessionId: string,
  cursorX?: number,
  cursorY?: number,
  selectionStart?: string,
  selectionEnd?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) {
      return { success: false, error: "Project access required" };
    }

    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
    ];
    const colorIndex = Math.abs(context.userId.charCodeAt(0)) % colors.length;
    const color = colors[colorIndex];

    const existing = await db.query.collaboratorPresence.findFirst({
      where: and(
        eq(collaboratorPresence.projectId, projectId),
        eq(collaboratorPresence.userId, context.userId),
        eq(collaboratorPresence.sessionId, sessionId),
      ),
    });

    if (existing) {
      await db
        .update(collaboratorPresence)
        .set({
          cursorX,
          cursorY,
          selectionStart,
          selectionEnd,
          lastHeartbeat: new Date(),
        })
        .where(and(
          eq(collaboratorPresence.id, existing.id),
          eq(collaboratorPresence.userId, context.userId),
        ));
    } else {
      await db.insert(collaboratorPresence).values({
        projectId,
        userId: context.userId,
        sessionId,
        cursorX,
        cursorY,
        selectionStart,
        selectionEnd,
        color,
      });
    }

    return { success: true };
  } catch (err) {
    console.error("[updatePresence]", err);
    return { success: false, error: "Failed to update presence" };
  }
}

export async function getCollaborators(projectId: string) {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) return [];
    const collaborators = await db.query.projectCollaborators.findMany({
      where: eq(projectCollaborators.projectId, projectId),
      with: { userId: true },
    });
    return collaborators;
  } catch (err) {
    console.error("[getCollaborators]", err);
    return [];
  }
}

export async function getActivePresence(projectId: string) {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) return [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const presence = await db.query.collaboratorPresence.findMany({
      where: and(
        eq(collaboratorPresence.projectId, projectId),
        // lastHeartbeat > fiveMinutesAgo would need custom comparison
      ),
    });
    return presence.filter((p) => p.lastHeartbeat > fiveMinutesAgo);
  } catch (err) {
    console.error("[getActivePresence]", err);
    return [];
  }
}

export async function getProjectEdits(projectId: string, since?: Date) {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) return [];
    const edits = await db.query.projectEdits.findMany({
      where: eq(projectEdits.projectId, projectId),
    });
    return since ? edits.filter((e) => e.createdAt > since) : edits;
  } catch (err) {
    console.error("[getProjectEdits]", err);
    return [];
  }
}

export async function submitEngineV2Transaction(
  projectId: string,
  envelope: EngineTransactionEnvelope,
): Promise<{ success: true; duplicate: boolean } | { success: false; error: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canEditProject(context.access)) return { success: false, error: "Editor access required" };
    if (!parseEngineTransactionEnvelope(JSON.stringify(envelope))) return { success: false, error: "Invalid Engine v2 transaction" };
    const recordId = engineTransactionRecordId(projectId, envelope.transaction.id);

    const existing = await db.select({ id: projectEdits.id }).from(projectEdits)
      .where(eq(projectEdits.id, recordId))
      .limit(1);
    if (existing.length) return { success: true, duplicate: true };

    const inserted = await db.insert(projectEdits).values({
      id: recordId,
      projectId,
      userId: context.userId,
      operation: "engine-v2-transaction",
      operationData: JSON.stringify(envelope),
      clientId: envelope.clientId,
      lamportTimestamp: Math.floor(Date.now() / 1000),
    }).onConflictDoNothing({ target: projectEdits.id }).returning({ id: projectEdits.id });

    return { success: true, duplicate: inserted.length === 0 };
  } catch (err) {
    console.error("[submitEngineV2Transaction]", err);
    return { success: false, error: "Failed to record Engine v2 transaction" };
  }
}

export async function pollEngineV2Collaboration(
  projectId: string,
  after: EngineEditCursor,
): Promise<{
  success: true;
  records: EngineTransactionRecord[];
  nextCursor: EngineEditCursor;
  hasMore: boolean;
  presence: Array<{ userId: string; sessionId: string; selectionId: string | null; color: string; lastHeartbeat: string }>;
} | { success: false; error: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) return { success: false, error: "Project access required" };
    const afterDate = new Date(after.createdAt);
    if (Number.isNaN(afterDate.getTime())) return { success: false, error: "Invalid collaboration cursor" };

    const rows = await db.select().from(projectEdits).where(and(
      eq(projectEdits.projectId, projectId),
      eq(projectEdits.operation, "engine-v2-transaction"),
      or(
        gt(projectEdits.createdAt, afterDate),
        and(eq(projectEdits.createdAt, afterDate), gt(projectEdits.id, after.id)),
      ),
    )).orderBy(asc(projectEdits.createdAt), asc(projectEdits.id)).limit(201);
    const page = rows.slice(0, 200);
    const records = page.flatMap((row): EngineTransactionRecord[] => {
      const envelope = parseEngineTransactionEnvelope(row.operationData);
      if (!envelope) return [];
      return [{ ...envelope, cursor: { createdAt: row.createdAt.toISOString(), id: row.id }, userId: row.userId }];
    });
    const last = page.at(-1);
    const nextCursor = last ? { createdAt: last.createdAt.toISOString(), id: last.id } : after;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activePresence = await db.select().from(collaboratorPresence).where(and(
      eq(collaboratorPresence.projectId, projectId),
      gt(collaboratorPresence.lastHeartbeat, fiveMinutesAgo),
    ));

    return {
      success: true,
      records,
      nextCursor,
      hasMore: rows.length > page.length,
      presence: activePresence.map((entry) => ({
        userId: entry.userId,
        sessionId: entry.sessionId,
        selectionId: entry.selectionStart,
        color: entry.color,
        lastHeartbeat: entry.lastHeartbeat.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[pollEngineV2Collaboration]", err);
    return { success: false, error: "Failed to load Engine v2 collaboration updates" };
  }
}

export type EngineV3CommandRecord = { envelope: EngineV3CommandEnvelope; cursor: EngineEditCursor; userId: string };

export async function submitEngineV3Command(projectId: string, envelope: EngineV3CommandEnvelope): Promise<{ success: true; duplicate: boolean } | { success: false; error: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canEditProject(context.access)) return { success: false, error: "Editor access required" };
    if (!parseEngineV3CommandEnvelope(envelope)) return { success: false, error: "Invalid Engine v3 command" };
    const recordId = `${projectId}:v3:${envelope.id}`;
    const inserted = await db.insert(projectEdits).values({
      id: recordId,
      projectId,
      userId: context.userId,
      operation: "engine-v3-command",
      operationData: JSON.stringify(envelope),
      clientId: envelope.actor,
      lamportTimestamp: envelope.baseRevision,
    }).onConflictDoNothing({ target: projectEdits.id }).returning({ id: projectEdits.id });
    return { success: true, duplicate: inserted.length === 0 };
  } catch (error) {
    console.error("[submitEngineV3Command]", error);
    return { success: false, error: "Failed to record Engine v3 command" };
  }
}

export async function pollEngineV3Collaboration(projectId: string, after: EngineEditCursor): Promise<{ success: true; records: EngineV3CommandRecord[]; nextCursor: EngineEditCursor; hasMore: boolean } | { success: false; error: string }> {
  try {
    const context = await getProjectAccess(projectId);
    if (!context || !canReadProject(context.access)) return { success: false, error: "Project access required" };
    const afterDate = new Date(after.createdAt);
    if (Number.isNaN(afterDate.getTime())) return { success: false, error: "Invalid collaboration cursor" };
    const rows = await db.select().from(projectEdits).where(and(
      eq(projectEdits.projectId, projectId),
      eq(projectEdits.operation, "engine-v3-command"),
      or(gt(projectEdits.createdAt, afterDate), and(eq(projectEdits.createdAt, afterDate), gt(projectEdits.id, after.id))),
    )).orderBy(asc(projectEdits.createdAt), asc(projectEdits.id)).limit(201);
    const page = rows.slice(0, 200);
    const records = page.flatMap((row): EngineV3CommandRecord[] => {
      try {
        const envelope = parseEngineV3CommandEnvelope(JSON.parse(row.operationData));
        return envelope ? [{ envelope, cursor: { createdAt: row.createdAt.toISOString(), id: row.id }, userId: row.userId }] : [];
      } catch { return []; }
    });
    const last = page.at(-1);
    return { success: true, records, nextCursor: last ? { createdAt: last.createdAt.toISOString(), id: last.id } : after, hasMore: rows.length > page.length };
  } catch (error) {
    console.error("[pollEngineV3Collaboration]", error);
    return { success: false, error: "Failed to load Engine v3 collaboration updates" };
  }
}

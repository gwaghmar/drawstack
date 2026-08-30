import { experimental_upgradeWebSocket } from "@vercel/functions";
import type { WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projectCollaborators, projects } from "@/lib/db/schema";
import { canEditProject, canReadProject, resolveProjectAccess, type ProjectAccess } from "@/lib/project-access";
import { ensureUserAndWorkspace } from "@/lib/user-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SignalingMessage = {
  type: "subscribe" | "unsubscribe" | "publish" | "ping";
  topics?: unknown;
  topic?: unknown;
  [key: string]: unknown;
};

// Best-effort single-instance signaling: under Fluid Compute, peers whose
// connections land on different instances of this function won't discover
// each other through here (they still fall back to BroadcastChannel within
// the same browser). Acceptable for current scale — revisit with a shared
// pub/sub (e.g. Redis) if cross-instance signaling becomes a real gap.
const topics = new Map<string, Set<WebSocket>>();
const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_TOPICS_PER_CONNECTION = 4;

async function resolveTopicAccess(
  topicName: string,
  userId: string,
  workspaceId: string,
): Promise<ProjectAccess> {
  if (topicName.length > 128) return null;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, topicName),
  });
  if (!project) return null;
  if (project.workspaceId === workspaceId) return "owner";

  const collaborator = await db.query.projectCollaborators.findFirst({
    where: and(
      eq(projectCollaborators.projectId, topicName),
      eq(projectCollaborators.userId, userId),
    ),
  });
  return resolveProjectAccess(project.workspaceId, workspaceId, collaborator?.role);
}

function subscribe(topicName: string, ws: WebSocket) {
  let subs = topics.get(topicName);
  if (!subs) {
    subs = new Set();
    topics.set(topicName, subs);
  }
  subs.add(ws);
}

function unsubscribe(topicName: string, ws: WebSocket) {
  const subs = topics.get(topicName);
  if (!subs) return;
  subs.delete(ws);
  if (subs.size === 0) topics.delete(topicName);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return new Response("Unauthorized", { status: 401 });
  const { user, workspace } = await ensureUserAndWorkspace(email);

  return experimental_upgradeWebSocket((ws) => {
    const subscribedTopics = new Set<string>();

    ws.on("message", async (raw: unknown) => {
      if (Buffer.byteLength(String(raw), "utf8") > MAX_MESSAGE_BYTES) {
        ws.close(1009, "Message too large");
        return;
      }
      let message: SignalingMessage;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!message?.type) return;

      switch (message.type) {
        case "subscribe": {
          const topicNames = Array.isArray(message.topics) ? message.topics : [];
          for (const topicName of topicNames) {
            if (typeof topicName !== "string") continue;
            if (subscribedTopics.size >= MAX_TOPICS_PER_CONNECTION) break;
            const access = await resolveTopicAccess(topicName, user.id, workspace.id);
            if (!canReadProject(access)) continue;
            subscribe(topicName, ws);
            subscribedTopics.add(topicName);
          }
          break;
        }
        case "unsubscribe": {
          const topicNames = Array.isArray(message.topics) ? message.topics : [];
          for (const topicName of topicNames) {
            if (typeof topicName !== "string") continue;
            unsubscribe(topicName, ws);
            subscribedTopics.delete(topicName);
          }
          break;
        }
        case "publish": {
          if (typeof message.topic !== "string") break;
          const access = await resolveTopicAccess(message.topic, user.id, workspace.id);
          if (!canEditProject(access)) break;
          if (!subscribedTopics.has(message.topic)) {
            subscribe(message.topic, ws);
            subscribedTopics.add(message.topic);
          }
          const subs = topics.get(message.topic);
          if (!subs) break;
          message.clients = subs.size;
          const payload = JSON.stringify(message);
          for (const client of subs) {
            if (client.readyState === client.OPEN) {
              client.send(payload);
            }
          }
          break;
        }
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      for (const topicName of subscribedTopics) {
        unsubscribe(topicName, ws);
      }
      subscribedTopics.clear();
    });
  });
}

import { experimental_upgradeWebSocket } from "@vercel/functions";
import type { WebSocket } from "ws";

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
  return experimental_upgradeWebSocket((ws) => {
    const subscribedTopics = new Set<string>();

    ws.on("message", (raw: unknown) => {
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

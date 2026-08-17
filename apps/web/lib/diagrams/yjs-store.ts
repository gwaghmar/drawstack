import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { type CanvasDocument, type CanvasShape } from "./freeform-canvas";

const IDENTITY_STORAGE_KEY = "flowstudio:yjs-identity";

const ADJECTIVES = [
  "Amber", "Azure", "Coral", "Crimson", "Emerald", "Golden", "Indigo", "Ivory",
  "Jade", "Lilac", "Maroon", "Onyx", "Rosy", "Ruby", "Sandy", "Scarlet",
  "Silver", "Slate", "Teal", "Violet",
];
const ANIMALS = [
  "Fox", "Otter", "Falcon", "Panther", "Heron", "Lynx", "Raven", "Wolf",
  "Hawk", "Badger", "Owl", "Puma", "Stork", "Marten", "Ibis", "Gecko",
  "Crane", "Mole", "Wren", "Bison",
];

// Fixed 8-hue palette so peer colors stay visually distinct and stable across sessions.
const PEER_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

type LocalIdentity = { name: string; color: string };

function randomIdentity(): LocalIdentity {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  return { name: `${adjective} ${animal}`, color };
}

function loadOrCreateIdentity(): LocalIdentity {
  if (typeof window === "undefined") return randomIdentity();
  try {
    const raw = window.sessionStorage.getItem(IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalIdentity>;
      if (parsed.name && parsed.color) return parsed as LocalIdentity;
    }
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — fall back to an ephemeral identity
  }
  const identity = randomIdentity();
  try {
    window.sessionStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore — identity just won't survive a reload
  }
  return identity;
}

// wss://y-webrtc-signaling-eu.herokuapp.com (y-webrtc's old bundled default) has been
// decommissioned for years — connecting to it just spams the console with failed
// upgrades. Resolve to our own signaling endpoint in production, and to nothing in
// local dev (y-webrtc still syncs same-origin tabs via BroadcastChannel).
function resolveSignalingUrls(): string[] {
  const configured = process.env.NEXT_PUBLIC_YJS_SIGNALING?.trim();
  if (configured) {
    return configured.split(",").map((url) => url.trim()).filter(Boolean);
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return [`wss://${window.location.host}/api/yjs-signaling`];
  }
  return [];
}

export type PeerCursor = { x: number; y: number } | null;
export type PeerInfo = { clientId: number; name: string; color: string; cursor: PeerCursor };

export class YjsCanvasStore {
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  yShapes: Y.Map<any>;
  identity: LocalIdentity;

  constructor(roomId: string, initialDoc: CanvasDocument, identity?: LocalIdentity) {
    this.ydoc = new Y.Doc();
    this.identity = identity ?? loadOrCreateIdentity();
    // Use WebRTC provider for serverless P2P syncing (ideal for prototypes)
    this.provider = new WebrtcProvider(roomId, this.ydoc, {
      signaling: resolveSignalingUrls(),
    });
    this.yShapes = this.ydoc.getMap("shapes");

    this.provider.awareness.setLocalStateField("user", {
      name: this.identity.name,
      color: this.identity.color,
    });
    this.provider.awareness.setLocalStateField("cursor", null);

    // Populate initial if empty
    this.ydoc.transact(() => {
      if (this.yShapes.size === 0) {
        initialDoc.shapes.forEach((shape) => {
          this.yShapes.set(shape.id, shape);
        });
      }
    });
  }

  syncLocalToYjs(shapes: CanvasShape[]) {
    this.ydoc.transact(() => {
      const currentIds = new Set(shapes.map((s) => s.id));

      // Delete removed
      for (const id of Array.from(this.yShapes.keys())) {
        if (!currentIds.has(id)) {
          this.yShapes.delete(id);
        }
      }

      // Add / Update
      for (const shape of shapes) {
        const existing = this.yShapes.get(shape.id);
        // Deep compare to avoid unnecessary CRDT updates
        if (JSON.stringify(existing) !== JSON.stringify(shape)) {
          this.yShapes.set(shape.id, shape);
        }
      }
    });
  }

  subscribe(callback: (shapes: CanvasShape[]) => void) {
    const observer = () => {
      const shapes: CanvasShape[] = [];
      this.yShapes.forEach((val) => {
        shapes.push(val as CanvasShape);
      });
      callback(shapes);
    };

    this.yShapes.observe(observer);

    // Return unsubscribe function
    return () => {
      this.yShapes.unobserve(observer);
    };
  }

  setLocalCursor(pos: { x: number; y: number } | null) {
    this.provider.awareness.setLocalStateField("cursor", pos);
  }

  onPeersChange(cb: (peers: PeerInfo[]) => void) {
    const awareness = this.provider.awareness;
    const handler = () => {
      const peers: PeerInfo[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const user = (state as { user?: { name?: string; color?: string } } | undefined)?.user;
        if (!user) return;
        const cursor = (state as { cursor?: PeerCursor } | undefined)?.cursor ?? null;
        peers.push({
          clientId,
          name: user.name ?? "Anonymous",
          color: user.color ?? PEER_COLORS[0],
          cursor,
        });
      });
      cb(peers);
    };

    awareness.on("change", handler);
    handler();

    return () => {
      awareness.off("change", handler);
    };
  }

  destroy() {
    this.provider.destroy();
    this.ydoc.destroy();
  }
}

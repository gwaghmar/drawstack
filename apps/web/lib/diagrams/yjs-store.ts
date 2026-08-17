import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { type CanvasDocument, type CanvasShape } from "./freeform-canvas";

export class YjsCanvasStore {
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  yShapes: Y.Map<any>;

  constructor(roomId: string, initialDoc: CanvasDocument) {
    this.ydoc = new Y.Doc();
    // Use WebRTC provider for serverless P2P syncing (ideal for prototypes)
    this.provider = new WebrtcProvider(roomId, this.ydoc, {
        signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });
    this.yShapes = this.ydoc.getMap("shapes");

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

  destroy() {
    this.provider.destroy();
    this.ydoc.destroy();
  }
}

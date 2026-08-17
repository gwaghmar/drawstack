export type CanvasEventType =
  | "ai_generate"
  | "ai_patch_ops"
  | "human_drag"
  | "human_add_shape"
  | "human_connect"
  | "human_style_change"
  | "autolayout"
  | "export_svg"
  | "undo"
  | "redo"
  | "vision_ingest";

export type CanvasLogEntry = {
  id: string;
  timestamp: number;
  type: CanvasEventType;
  description: string;
  modelId?: string;
  promptText?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokenCostEstimate?: number;
  opsCount?: number;
  shapesCount?: number;
  status: "success" | "warning" | "error";
  details?: Record<string, unknown>;
};

class CanvasLogger {
  private logs: CanvasLogEntry[] = [];
  private listeners: Set<(logs: CanvasLogEntry[]) => void> = new Set();
  private maxLogs = 300;

  log(entry: Omit<CanvasLogEntry, "id" | "timestamp">): CanvasLogEntry {
    const fullEntry: CanvasLogEntry = {
      ...entry,
      id: "log-" + Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.notify();
    return fullEntry;
  }

  getLogs(): CanvasLogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  subscribe(listener: (logs: CanvasLogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getLogs();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const canvasLogger = new CanvasLogger();

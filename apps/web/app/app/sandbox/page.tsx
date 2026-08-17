"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { canvasLogger, type CanvasLogEntry } from "@/lib/diagrams/canvas-logger";
import { autoLayoutFreeformDocument } from "@/lib/diagrams/freeform-autolayout";
import { type CanvasDocument } from "@/lib/diagrams/freeform-canvas";

const FreeformRenderer = dynamic(
  () => import("@/components/diagrams/freeform-renderer").then((m) => m.FreeformRenderer),
  { ssr: false, loading: () => <div className="p-8 text-sm text-slate-400">Loading Canvas Engine...</div> }
);

const INITIAL_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "client",
      type: "rectangle",
      x: 60,
      y: 120,
      width: 150,
      height: 75,
      fill: "5",
      stroke: "#2563eb",
      text: { content: "Web Client", bold: true },
    },
    {
      id: "api",
      type: "rectangle",
      x: 280,
      y: 120,
      width: 150,
      height: 75,
      fill: "1",
      stroke: "#0284c7",
      text: { content: "API Gateway", bold: true },
    },
    {
      id: "db",
      type: "cylinder",
      x: 500,
      y: 105,
      width: 140,
      height: 100,
      fill: "4",
      stroke: "#16a34a",
      text: { content: "PostgreSQL", bold: true },
    },
    {
      id: "a1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "client", anchor: "right" },
      end: { shapeId: "api", anchor: "left" },
      label: "HTTPS",
    },
    {
      id: "a2",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "api", anchor: "right" },
      end: { shapeId: "db", anchor: "left" },
      label: "SQL",
    },
  ],
};

const TEST_PROMPTS = [
  {
    label: "1. Add Redis Cache",
    prompt: "Add a cylinder database node for 'Redis Cache' placed below the API Gateway with green fill, and connect the API Gateway to Redis with label 'Cache Get/Set'",
  },
  {
    label: "2. Add Stripe Payments",
    prompt: "Add a cloud node for 'Stripe API' with rose fill placed to the right of API Gateway, and connect API Gateway to Stripe with label 'Charge'",
  },
  {
    label: "3. Decision Gate",
    prompt: "Insert a diamond decision node for 'Is Authenticated?' between Web Client and API Gateway with amber fill",
  },
  {
    label: "4. Full Microservice Cloud",
    prompt: "Create a complete e-commerce cloud system with Web Client, Load Balancer, Auth Service, Order Service, PostgreSQL DB, Redis Cache, and Stripe Cloud",
  },
];

export default function CanvasSandboxPage() {
  const [source, setSource] = useState<string>(() => JSON.stringify(INITIAL_DOC, null, 2));
  const [logs, setLogs] = useState<CanvasLogEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-flash-latest");
  const [selectedProvider, setSelectedProvider] = useState("google");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [visionImage, setVisionImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalTokens: 0,
    totalCost: 0,
    lastLatencyMs: 0,
    shapesCount: 5,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return canvasLogger.subscribe((allLogs) => {
      setLogs(allLogs);
    });
  }, []);

  const handleSourceChange = (newSource: string) => {
    setSource(newSource);
    try {
      const parsed = JSON.parse(newSource);
      if (parsed?.shapes) {
        setMetrics((prev) => ({ ...prev, shapesCount: parsed.shapes.length }));
      }
    } catch {}
  };

  const handleRunAiPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptText }],
          diagramType: "freeform",
          source,
          provider: selectedProvider,
          modelId: selectedModel,
        }),
      });

      const data = await res.json();
      const latency = Date.now() - startTime;

      if (data.source) {
        setSource(data.source);
        const tokens = (data.usage?.promptTokens ?? 400) + (data.usage?.completionTokens ?? 150);
        // Cost estimate roughly $0.075 / 1M tokens for Flash
        const cost = (tokens / 1_000_000) * 0.1;

        setMetrics((prev) => ({
          totalTokens: prev.totalTokens + tokens,
          totalCost: prev.totalCost + cost,
          lastLatencyMs: latency,
          shapesCount: JSON.parse(data.source)?.shapes?.length ?? prev.shapesCount,
        }));

        canvasLogger.log({
          type: "ai_patch_ops",
          description: `Executed AI edit: "${promptText.slice(0, 45)}..."`,
          modelId: selectedModel,
          promptText,
          latencyMs: latency,
          inputTokens: data.usage?.promptTokens ?? 400,
          outputTokens: data.usage?.completionTokens ?? 150,
          tokenCostEstimate: cost,
          status: "success",
        });
      } else {
        canvasLogger.log({
          type: "ai_patch_ops",
          description: `AI error: ${data.error || "No response"}`,
          modelId: selectedModel,
          promptText,
          latencyMs: latency,
          status: "error",
        });
      }
    } catch (err: any) {
      canvasLogger.log({
        type: "ai_patch_ops",
        description: `Request failed: ${err.message}`,
        modelId: selectedModel,
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoLayout = (dir: "LR" | "TB") => {
    try {
      const doc: CanvasDocument = JSON.parse(source);
      const laidOut = autoLayoutFreeformDocument(doc, { direction: dir });
      const serialized = JSON.stringify(laidOut, null, 2);
      setSource(serialized);
      canvasLogger.log({
        type: "autolayout",
        description: `Tidied up canvas layout (${dir})`,
        status: "success",
        shapesCount: laidOut.shapes.length,
      });
    } catch (e: any) {
      canvasLogger.log({
        type: "autolayout",
        description: `Layout error: ${e.message}`,
        status: "error",
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setVisionImage(base64);
      setIsLoading(true);

      canvasLogger.log({
        type: "vision_ingest",
        description: `Starting vision extraction on image (${file.name})`,
        status: "success",
      });

      try {
        const res = await fetch("/api/ai/vision-to-canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            provider: selectedProvider,
            modelId: selectedModel,
          }),
        });
        const data = await res.json();
        if (data.success && data.source) {
          setSource(data.source);
          canvasLogger.log({
            type: "vision_ingest",
            description: "Extracted whiteboard image into native editable shapes",
            latencyMs: data.latencyMs,
            status: "success",
            shapesCount: data.doc?.shapes?.length ?? 0,
          });
        }
      } catch (err: any) {
        canvasLogger.log({
          type: "vision_ingest",
          description: `Vision error: ${err.message}`,
          status: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 font-sans">
      {/* ─── Top Telemetry & Control Banner ────────────────────────────────── */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="font-bold text-sm tracking-tight text-white">Engine Testing Sandbox</h1>
          </div>
          <span className="rounded bg-indigo-950 px-2 py-0.5 text-[11px] font-medium text-indigo-300 border border-indigo-800">
            Agent-Native Freeform v2.5
          </span>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-6 text-xs text-slate-300">
          <div>
            <span className="text-slate-500">Shapes: </span>
            <span className="font-semibold text-white">{metrics.shapesCount}</span>
          </div>
          <div>
            <span className="text-slate-500">Last Latency: </span>
            <span className="font-semibold text-emerald-400">{metrics.lastLatencyMs}ms</span>
          </div>
          <div>
            <span className="text-slate-500">Tokens: </span>
            <span className="font-semibold text-sky-400">{metrics.totalTokens}</span>
          </div>
          <div>
            <span className="text-slate-500">Total Cost: </span>
            <span className="font-semibold text-amber-400">${metrics.totalCost.toFixed(6)}</span>
          </div>
        </div>

        {/* Model Selector & Layout Buttons */}
        <div className="flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              if (e.target.value.includes("gemini")) setSelectedProvider("google");
              if (e.target.value.includes("gpt")) setSelectedProvider("openai");
              if (e.target.value.includes("claude")) setSelectedProvider("anthropic");
              if (e.target.value.includes("llama")) setSelectedProvider("groq");
            }}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-white outline-none"
          >
            <option value="gemini-flash-latest">Gemini 2.5 Flash (Ultra Fast / Cheap)</option>
            <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B</option>
          </select>

          <button
            type="button"
            onClick={() => handleAutoLayout("LR")}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 border border-slate-700"
            title="Auto-Layout Horizontally"
          >
            Tidy LR
          </button>
          <button
            type="button"
            onClick={() => handleAutoLayout("TB")}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 border border-slate-700"
            title="Auto-Layout Vertically"
          >
            Tidy TB
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm"
          >
            Upload Sketch / Photo
          </button>
        </div>
      </header>

      {/* ─── Main Workspace: Canvas + Live Telemetry Drawer ───────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Live Canvas Area */}
        <div className="relative flex-1 h-full bg-slate-900 overflow-hidden">
          <FreeformRenderer
            source={source}
            onChange={handleSourceChange}
          />

          {/* Quick Test Prompt Overlay Bar */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-xl backdrop-blur max-w-xl">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span>Automated Test Scenarios</span>
              {isLoading && <span className="text-amber-400 animate-pulse">Running AI Model...</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEST_PROMPTS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleRunAiPrompt(t.prompt)}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200 hover:border-indigo-500 hover:bg-indigo-950/60 transition-colors disabled:opacity-50"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRunAiPrompt(customPrompt);
                    setCustomPrompt("");
                  }
                }}
                placeholder="Ask AI to add/change anything on canvas..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                disabled={isLoading || !customPrompt.trim()}
                onClick={() => {
                  handleRunAiPrompt(customPrompt);
                  setCustomPrompt("");
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Live Telemetry & Inspector Drawer */}
        <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Event Stream
            </h2>
            <button
              type="button"
              onClick={() => canvasLogger.clear()}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs font-mono">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-slate-600">No events recorded yet. Interact with the canvas or run a prompt.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded border p-2 ${
                    log.status === "error"
                      ? "border-red-900/50 bg-red-950/20 text-red-300"
                      : log.type === "ai_patch_ops"
                      ? "border-indigo-900/50 bg-indigo-950/20 text-indigo-200"
                      : "border-slate-800 bg-slate-900/50 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-400">{log.type}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-sans">{log.description}</div>
                  {log.latencyMs !== undefined && (
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Latency: {log.latencyMs}ms</span>
                      {log.outputTokens && <span>Tokens: {log.outputTokens}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

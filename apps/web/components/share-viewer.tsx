"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import mermaid from "mermaid";
import { toPng } from "html-to-image";
import Link from "next/link";
import { buildMermaidConfig, getTheme } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";
import { downloadSource, sourceFileExtension } from "@/lib/diagrams/source-export";

// Lazy-load heavy renderers so they don't bloat the share page bundle
const ExcalidrawRenderer = dynamic(
  () => import("./diagrams/excalidraw-renderer").then((m) => m.ExcalidrawRenderer),
  { ssr: false }
);
const ReactFlowRenderer = dynamic(
  () => import("./diagrams/reactflow-renderer").then((m) => m.ReactFlowRenderer),
  { ssr: false }
);
const EChartsRenderer = dynamic(
  () => import("./diagrams/echarts-renderer").then((m) => m.EChartsRenderer),
  { ssr: false }
);
const NivoRenderer = dynamic(
  () => import("./diagrams/nivo-renderer").then((m) => m.NivoRenderer),
  { ssr: false }
);
const BpmnRenderer = dynamic(
  () => import("./diagrams/bpmn-renderer").then((m) => m.BpmnRenderer),
  { ssr: false }
);
const CloudRenderer = dynamic(
  () => import("./diagrams/cloud-renderer").then((m) => m.CloudRenderer),
  { ssr: false }
);
const ErdRenderer = dynamic(
  () => import("./diagrams/erd-renderer").then((m) => m.ErdRenderer),
  { ssr: false }
);
const OrgChartRenderer = dynamic(
  () => import("./diagrams/orgchart-renderer").then((m) => m.OrgChartRenderer),
  { ssr: false }
);
const SocialCardRenderer = dynamic(
  () => import("./diagrams/social-card-renderer").then((m) => m.SocialCardRenderer),
  { ssr: false }
);
const FreeformRenderer = dynamic(
  () => import("./diagrams/freeform-renderer").then((m) => m.FreeformRenderer),
  { ssr: false }
);

type ShareData = {
  title: string;
  source: string;
  themeId: string;
  diagramType: DiagramType;
};

export function ShareViewer({ token, authorHandle }: { token: string; authorHandle?: string | null }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceCopied, setSourceCopied] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => getTheme(data?.themeId ?? "stage_pipeline"), [data?.themeId]);

  // Fetch share data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError(res.status === 410 ? "This share link has expired." : "This link is invalid or no longer available.");
        return;
      }
      const j = await res.json();
      if (!cancelled) setData({ ...j, diagramType: j.diagramType ?? "mermaid" });
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Mermaid-specific rendering into the innerRef div
  useEffect(() => {
    if (!data || data.diagramType !== "mermaid") return;
    let cancelled = false;
    (async () => {
      mermaid.initialize({
        ...buildMermaidConfig(theme),
        startOnLoad: false,
        suppressErrorRendering: true,
      });
      try {
        const { svg } = await mermaid.render(`s${Date.now()}`, data.source);
        if (!cancelled && innerRef.current) innerRef.current.innerHTML = svg;
      } catch {
        if (!cancelled) setError("Failed to render this diagram.");
      }
    })();
    return () => { cancelled = true; };
  }, [data, theme]);

  const downloadPng = async () => {
    const node = frameRef.current;
    if (!node) return;
    const url = await toPng(node, { pixelRatio: 2 });
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.title ?? "diagram"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copySource = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.source);
      setSourceCopied(true);
      setTimeout(() => setSourceCopied(false), 1500);
    } catch {
      /* clipboard unavailable — Download source still works */
    }
  };

  const diagramType = data?.diagramType ?? "mermaid";
  const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
    mermaid: "Text flowchart",
    excalidraw: "Whiteboard",
    reactflow: "Node graph",
    echarts: "Chart",
    nivo: "Chart",
    bpmn: "BPMN process",
    cloud: "Cloud architecture",
    erd: "Database schema",
    orgchart: "Org chart",
    timeline: "Timeline",
    versus: "Versus",
    matrix2x2: "2x2 Matrix",
    funnel: "Funnel",
    venn: "Venn Diagram",
    tierlist: "Tier List",
    iceberg: "Iceberg",
    alignment: "Alignment Chart",
    budget: "Budget Breakdown",
    habits: "Habit Tracker",
    bingo: "Bingo Card",
    bracket: "Bracket",
    freeform: "Free Canvas",
  };

  return (
    <div className="dot-grid-bg min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-slate-900">
          {data?.title ?? "Shared diagram"}
        </h1>
        {authorHandle && (
          <p className="text-xs text-slate-500 mt-1">
            by{" "}
            <a href={`/u/${authorHandle}`} className="text-indigo-600 hover:underline">
              @{authorHandle}
            </a>
          </p>
        )}
        <p className="mt-1 text-sm text-slate-500">
          {data ? `${DIAGRAM_TYPE_LABELS[diagramType]} · ` : ""}
          View-only link. Export a PNG or grab the raw source from this page.
        </p>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {data && (
          <>
            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={downloadPng}
                className="rounded-sm bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                Download PNG
              </button>
              <button
                onClick={copySource}
                className="rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {sourceCopied ? "Copied!" : "Copy source"}
              </button>
              {data && (
                <button
                  onClick={() => downloadSource(data.source, diagramType, data.title || "diagram")}
                  className="rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {`Download .${sourceFileExtension(diagramType)}`}
                </button>
              )}
              {diagramType === "mermaid" && (
                <span className="text-xs text-slate-500">
                  Theme: <span className="font-medium">{theme.name}</span>
                </span>
              )}
            </div>

            <div
              ref={frameRef}
              className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white"
              style={{
                background: diagramType === "mermaid" ? (theme.themeVariables.background ?? "#fff") : "#fff",
                minHeight: "400px",
              }}
            >
              {diagramType === "mermaid" && (
                <div className="p-6">
                  <div ref={innerRef} className="[&_svg]:max-w-full [&_svg]:h-auto" />
                </div>
              )}
              {diagramType === "excalidraw" && (
                <div className="h-[600px]">
                  <ExcalidrawRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "reactflow" && (
                <div className="h-[600px]">
                  <ReactFlowRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "echarts" && (
                <div className="h-[500px] p-4">
                  <EChartsRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "nivo" && (
                <div className="h-[500px] p-4">
                  <NivoRenderer source={data.source} />
                </div>
              )}
              {diagramType === "freeform" && (
                <div className="h-[600px]">
                  <FreeformRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "bpmn" && (
                <div className="h-[600px]">
                  <BpmnRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "cloud" && (
                <div className="h-[600px]">
                  <CloudRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "erd" && (
                <div className="h-[600px]">
                  <ErdRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {diagramType === "orgchart" && (
                <div className="h-[600px]">
                  <OrgChartRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
              {(diagramType === "timeline" || diagramType === "versus" || diagramType === "matrix2x2" || diagramType === "funnel" || diagramType === "venn" || diagramType === "tierlist" || diagramType === "iceberg" || diagramType === "alignment" || diagramType === "budget" || diagramType === "habits" || diagramType === "bingo" || diagramType === "bracket") && (
                <div className="h-[600px] [container-type:size]">
                  <SocialCardRenderer source={data.source} readOnly onChange={() => {}} />
                </div>
              )}
            </div>
          </>
        )}

        {!data && !error && (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          </div>
        )}
      </div>

      {/* Made with drawxyz badge */}
      <Link
        href="/"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-xs backdrop-blur-xs hover:bg-white hover:text-indigo-600 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7l3 3 3-3h5v5l-3 3 3 3v5h-5l-3-3-3 3H3v-5l3-3-3-3V3z"/></svg>
        Made with drawxyz
      </Link>
    </div>
  );
}


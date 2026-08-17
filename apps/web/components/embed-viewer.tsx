"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import mermaid from "mermaid";
import { buildMermaidConfig, getTheme } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";

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

export function EmbedViewer({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceCopied, setSourceCopied] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => getTheme(data?.themeId ?? "stage_pipeline"), [data?.themeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError(res.status === 410 ? "This embed link has expired." : "This link is invalid.");
        return;
      }
      const j = await res.json();
      if (!cancelled) setData({ ...j, diagramType: j.diagramType ?? "mermaid" });
    })();
    return () => { cancelled = true; };
  }, [token]);

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
        const { svg } = await mermaid.render(`e${Date.now()}`, data.source);
        if (!cancelled && innerRef.current) innerRef.current.innerHTML = svg;
      } catch {
        if (!cancelled) setError("Failed to render this diagram.");
      }
    })();
    return () => { cancelled = true; };
  }, [data, theme]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-white px-4 text-center text-sm text-slate-500">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  const diagramType = data.diagramType;
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
    d3: "D3 Visualization",
    cytoscape: "Network Graph",
    visnetwork: "Physics Network",
    fabric: "Design Canvas",
    pixi: "WebGL Canvas",
  };
  const bg = diagramType === "mermaid" ? (theme.themeVariables.background ?? "#fff") : "#fff";

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(data.source);
      setSourceCopied(true);
      setTimeout(() => setSourceCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group relative h-screen w-screen overflow-hidden" style={{ background: bg }}>
      <button
        onClick={copySource}
        title="Copy diagram source"
        className="absolute bottom-2 right-2 z-10 rounded border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500 opacity-0 backdrop-blur-sm transition-opacity hover:text-slate-800 group-hover:opacity-100"
      >
        {sourceCopied ? "Copied!" : "</> source"}
      </button>
      {diagramType === "mermaid" && (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div ref={innerRef} className="[&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto" />
        </div>
      )}
      {diagramType === "excalidraw" && (
        <ExcalidrawRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "reactflow" && (
        <ReactFlowRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "echarts" && (
        <div className="h-full w-full p-2">
          <EChartsRenderer source={data.source} readOnly onChange={() => {}} />
        </div>
      )}
      {diagramType === "nivo" && (
        <div className="h-full w-full p-2">
          <NivoRenderer source={data.source} />
        </div>
      )}
      {diagramType === "freeform" && (
        <FreeformRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "bpmn" && (
        <BpmnRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "cloud" && (
        <CloudRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "erd" && (
        <ErdRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {diagramType === "orgchart" && (
        <OrgChartRenderer source={data.source} readOnly onChange={() => {}} />
      )}
      {(diagramType === "timeline" || diagramType === "versus" || diagramType === "matrix2x2" || diagramType === "funnel" || diagramType === "venn" || diagramType === "tierlist" || diagramType === "iceberg" || diagramType === "alignment" || diagramType === "budget" || diagramType === "habits" || diagramType === "bingo" || diagramType === "bracket") && (
        <div className="h-full w-full [container-type:size]">
          <SocialCardRenderer source={data.source} readOnly onChange={() => {}} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Code2, Copy, CopyPlus, Download, GripVertical, History, Loader2, MousePointer2, Redo2, RotateCcw, Save, Share2, Sparkles, Trash2, Undo2, Upload, X } from "lucide-react";
import { createEngineV2Project, listEngineV2Revisions, restoreEngineV2Revision, saveEngineV2Project } from "@/app/actions/engine-v2";
import { createShareLink } from "@/app/actions/share";
import { DeterministicChart } from "@/components/engine-v2/charts";
import { GraphRenderer } from "@/components/engine-v2/graph";
import {
  ENGINE_V2_SAMPLE,
  findNode,
  mapNode,
  nodeStyle,
  resolveToken,
  type EngineChartNode,
  type EngineDocument,
  type EngineFrameNode,
  type EngineNode,
  type EngineTokens,
} from "@/lib/engine-v2/document";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";
import { duplicateNode, findParent, moveNodeByArrow, moveNodeDown, moveNodeToParent, moveNodeUp, removeNode } from "@/lib/engine-v2/operations";
import { createEngineV2JsonExport, createEngineV2PrintHtmlExport, createEngineV2ReactTsxExport, createEngineV2SvgExport, type EngineV2ExportPayload } from "@/lib/engine-v2/export";

function Frame({ node, tokens, selectedId, onSelect }: { node: EngineFrameNode; tokens: EngineTokens; selectedId: string; onSelect: (id: string) => void }) {
  const layout = node.layout;
  const layoutStyle = layout.mode === "grid"
    ? { display: "grid", gridTemplateColumns: `repeat(${layout.columns ?? 1}, minmax(0, 1fr))`, gap: layout.gap, padding: layout.padding }
    : { display: "flex", flexDirection: layout.direction ?? "row", gap: layout.gap, padding: layout.padding, alignItems: layout.align, justifyContent: layout.justify };

  return (
    <div
      data-node-id={node.id}
      data-node-type={node.type}
      data-layout={layout.mode}
      data-direction={layout.direction}
      onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}
      style={{ ...layoutStyle, ...nodeStyle(node.style, tokens) }}
      className={`relative box-border ${selectedId === node.id ? "outline outline-2 outline-offset-2 outline-[#3157F6]" : ""}`}
    >
      {node.children.map((child) => (
        <Node key={child.id} node={child} tokens={tokens} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Node({ node, tokens, selectedId, onSelect }: { node: EngineNode; tokens: EngineTokens; selectedId: string; onSelect: (id: string) => void }) {
  if (node.type === "frame") return <Frame node={node} tokens={tokens} selectedId={selectedId} onSelect={onSelect} />;

  const selected = selectedId === node.id;
  const shared = {
    "data-node-id": node.id,
    "data-node-type": node.type,
    onClick: (event: React.MouseEvent) => { event.stopPropagation(); onSelect(node.id); },
    style: nodeStyle(node.style, tokens),
    className: `box-border ${selected ? "outline outline-2 outline-offset-2 outline-[#3157F6]" : ""}`,
  };

  if (node.type === "text") {
    const variants = {
      eyebrow: "font-mono text-[11px] font-semibold tracking-[0.18em]",
      display: "max-w-[720px] text-[clamp(38px,5.4vw,58px)] font-semibold leading-[0.94] tracking-[-0.055em]",
      heading: "text-2xl font-semibold tracking-[-0.03em]",
      body: "text-[15px] leading-6",
      caption: "font-mono text-[11px] tracking-wide",
    };
    return <div {...shared} className={`${shared.className} ${variants[node.variant]}`}>{node.content}</div>;
  }

  if (node.type === "metric") {
    const accent = node.tone === "positive" ? tokens.colors.cobalt : node.tone === "warning" ? tokens.colors.orange : tokens.colors.ink;
    return (
      <section {...shared} className={`${shared.className} min-w-0 rounded-[14px] border border-[#D7DBD2] bg-white p-5`}>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-[#667067]">{node.label}</div>
        <div className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.045em]" style={{ color: accent }}>{node.value}</div>
        <div className="mt-3 text-xs text-[#667067]">{node.detail}</div>
      </section>
    );
  }

  if (node.type === "graph") {
    return (
      <section {...shared} className={`${shared.className} min-w-0 rounded-[14px] border border-[#D7DBD2] bg-white p-5`}>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{node.title}</h3>
          <span className="rounded-full bg-[#E9EDFF] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#3157F6]">deterministic graph</span>
        </div>
        <GraphRenderer
          graph={node.graph}
          className="mt-4"
          palette={{ background: tokens.colors.panel, ink: tokens.colors.ink, quiet: tokens.colors.quiet, rule: tokens.colors.rule, accent: tokens.colors.cobalt, warning: tokens.colors.orange }}
        />
      </section>
    );
  }

  return (
    <section {...shared} className={`${shared.className} min-w-0 rounded-[14px] border border-[#D7DBD2] bg-white p-5`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{node.title}</h3>
        <span className="rounded-full bg-[#F0F2EC] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#667067]">deterministic {node.chartType}</span>
      </div>
      <DeterministicChart
        className="mt-4"
        spec={{
          type: node.chartType,
          title: node.title,
          data: node.data,
          valuePrefix: node.valuePrefix,
          valueSuffix: node.valueSuffix,
          showValues: node.chartType === "bar",
          palette: {
            foreground: tokens.colors.ink,
            muted: tokens.colors.quiet,
            grid: tokens.colors.rule,
            surface: tokens.colors.panel,
            series: [tokens.colors.cobalt, tokens.colors.orange, "#1D8A6A", "#8755D9"],
          },
        }}
      />
    </section>
  );
}

type TreeDropPosition = "before" | "inside" | "after";

type TreeDropTarget = {
  nodeId: string;
  position: TreeDropPosition;
};

type TreeProps = {
  nodes: EngineNode[];
  selectedId: string;
  draggedId: string | null;
  dropTarget: TreeDropTarget | null;
  parentId?: string | null;
  depth?: number;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTarget: (target: TreeDropTarget | null) => void;
  onMove: (id: string, parentId: string | null, insertionIndex: number) => void;
  onKeyboardMove: (id: string, direction: "up" | "down" | "left" | "right") => void;
};

function Tree({ nodes, selectedId, draggedId, dropTarget, parentId = null, depth = 0, onSelect, onDragStart, onDragEnd, onDropTarget, onMove, onKeyboardMove }: TreeProps) {
  const positionForPointer = (node: EngineNode, element: HTMLElement, clientY: number): TreeDropPosition => {
    const bounds = element.getBoundingClientRect();
    const ratio = bounds.height ? (clientY - bounds.top) / bounds.height : 0.5;
    if (node.type === "frame" && ratio >= 0.25 && ratio <= 0.75) return "inside";
    return ratio < 0.5 ? "before" : "after";
  };

  return (
    <div className="space-y-0.5" role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Document structure" : undefined}>
      {nodes.map((node, index) => {
        const activePosition = dropTarget?.nodeId === node.id ? dropTarget.position : null;
        return (
          <div key={node.id} className="relative" role="treeitem" aria-level={depth + 1} aria-selected={selectedId === node.id} aria-expanded={node.type === "frame" ? true : undefined}>
            {activePosition === "before" ? <div className="pointer-events-none absolute inset-x-1 -top-[2px] z-10 h-0.5 rounded-full bg-[#3157F6]" /> : null}
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
                event.preventDefault();
                onKeyboardMove(node.id, event.key.slice(5).toLowerCase() as "up" | "down" | "left" | "right");
              }}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
              data-tree-node-id={node.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", node.id);
                onDragStart(node.id);
              }}
              onDragEnd={onDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                onDropTarget({ nodeId: node.id, position: positionForPointer(node, event.currentTarget, event.clientY) });
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const sourceId = draggedId ?? event.dataTransfer.getData("text/plain");
                const position = positionForPointer(node, event.currentTarget, event.clientY);
                if (sourceId) {
                  if (position === "inside" && node.type === "frame") onMove(sourceId, node.id, node.children.length);
                  else onMove(sourceId, parentId, index + (position === "after" ? 1 : 0));
                }
                onDragEnd();
              }}
              style={{ paddingLeft: 10 + depth * 14 }}
              className={`flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${draggedId === node.id ? "opacity-45" : ""} ${activePosition === "inside" ? "bg-[#DCE3FF] ring-1 ring-inset ring-[#3157F6]" : selectedId === node.id ? "bg-[#E9EDFF] text-[#2448D8]" : "text-[#566057] hover:bg-[#F0F2EC]"}`}
            >
              <GripVertical size={12} className="shrink-0 cursor-grab opacity-35" aria-hidden="true" />
              <span className="w-12 shrink-0 font-mono text-[9px] uppercase tracking-wide opacity-70">{node.type}</span>
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {node.type === "frame" ? <Tree nodes={node.children} selectedId={selectedId} draggedId={draggedId} dropTarget={dropTarget} parentId={node.id} depth={depth + 1} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropTarget={onDropTarget} onMove={onMove} onKeyboardMove={onKeyboardMove} /> : null}
            {activePosition === "after" ? <div className="pointer-events-none absolute inset-x-1 bottom-[-2px] z-10 h-0.5 rounded-full bg-[#3157F6]" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function EngineDocumentView({ document, className = "" }: { document: EngineDocument; className?: string }) {
  return (
    <div className={className} data-engine-document="v2" style={{ width: "100%", maxWidth: document.artboard.width, minHeight: document.artboard.minHeight, background: resolveToken(document.artboard.background, document.tokens) }}>
      {document.children.map((node) => <Node key={node.id} node={node} tokens={document.tokens} selectedId="" onSelect={() => {}} />)}
    </div>
  );
}

export function EngineCanvas({ initialDocument = ENGINE_V2_SAMPLE, initialProjectId = null }: { initialDocument?: EngineDocument; initialProjectId?: string | null }) {
  const router = useRouter();
  const [document, setDocument] = useState<EngineDocument>(initialDocument);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [past, setPast] = useState<EngineDocument[]>([]);
  const [future, setFuture] = useState<EngineDocument[]>([]);
  const [selectedId, setSelectedId] = useState("title");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [prompt, setPrompt] = useState("Create a concise product launch dashboard with revenue, conversion, and channel performance");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");
  const [treeDraggedId, setTreeDraggedId] = useState<string | null>(null);
  const [treeDropTarget, setTreeDropTarget] = useState<TreeDropTarget | null>(null);
  const [revisions, setRevisions] = useState<Array<{ id: string; label: string | null; createdAt: Date }>>([]);
  const artboardRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => findNode(document.children, selectedId), [document, selectedId]);
  const storageKey = `drawstack.engine-v2.document.${projectId ?? "draft"}`;

  useEffect(() => {
    const saved = projectId ? null : window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as EngineDocument;
        if (parsed.version === 2 && parsed.engine === "dom-css") setDocument(parsed);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setHydrated(true);
  }, [projectId, storageKey]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(document));
  }, [document, hydrated, storageKey]);

  useEffect(() => {
    if (!projectId || !historyOpen) return;
    listEngineV2Revisions(projectId).then(setRevisions).catch(() => setRevisions([]));
  }, [historyOpen, projectId, saveState]);

  const commitDocument = (update: EngineDocument | ((current: EngineDocument) => EngineDocument)) => {
    setDocument((current) => {
      const next = typeof update === "function" ? update(current) : update;
      if (next === current) return current;
      setPast((items) => [...items.slice(-49), current]);
      setFuture([]);
      setSaveState("idle");
      return next;
    });
  };

  const updateSelected = (update: (node: EngineNode) => EngineNode) => {
    commitDocument((current) => ({ ...current, children: mapNode(current.children, selectedId, update) }));
  };

  const copyDocument = async () => {
    await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const resetDocument = () => {
    commitDocument(ENGINE_V2_SAMPLE);
    setSelectedId("title");
    setGenerationError(null);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [document, ...items.slice(0, 49)]);
    setDocument(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-49), document]);
    setDocument(next);
  };

  const saveDocument = async () => {
    setSaveState("saving");
    try {
      if (projectId) {
        await saveEngineV2Project(projectId, document.name, JSON.stringify(document), "Engine v2 save");
      } else {
        const id = await createEngineV2Project(document.name, JSON.stringify(document));
        setProjectId(id);
        router.replace(`/app/engine-v2?id=${id}`);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const shareDocument = async () => {
    setShareState("sharing");
    try {
      let id = projectId;
      if (id) await saveEngineV2Project(id, document.name, JSON.stringify(document), "Shared version");
      else {
        id = await createEngineV2Project(document.name, JSON.stringify(document));
        setProjectId(id);
        router.replace(`/app/engine-v2?id=${id}`);
      }
      let preview: string | undefined;
      if (artboardRef.current) {
        const { toPng } = await import("html-to-image");
        preview = await toPng(artboardRef.current, { pixelRatio: 1, cacheBust: true });
      }
      const token = await createShareLink(id, preview);
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("error");
    }
  };

  const importDocument = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = validateEngineV2Document(parsed);
      if (!result.ok) throw new Error(result.issues[0]?.message || "Invalid document");
      commitDocument(result.document);
      setSelectedId(result.document.children[0]?.id ?? "");
      setGenerationError(null);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Import failed");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const restoreRevision = async (revisionId: string) => {
    if (!projectId) return;
    try {
      const source = await restoreEngineV2Revision(projectId, revisionId);
      const result = validateEngineV2Document(JSON.parse(source) as unknown);
      if (!result.ok) throw new Error("Stored revision is invalid");
      commitDocument(result.document);
      setHistoryOpen(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const duplicateSelected = () => {
    const restoreTreeFocus = treeRef.current?.contains(window.document.activeElement) ?? false;
    const result = duplicateNode(document.children, selectedId);
    if (result.nodes === document.children) return;
    commitDocument({ ...document, children: result.nodes });
    setSelectedId(result.duplicatedId);
    if (restoreTreeFocus) focusTreeNode(result.duplicatedId);
  };

  const removeSelected = () => {
    const restoreTreeFocus = treeRef.current?.contains(window.document.activeElement) ?? false;
    const location = findParent(document.children, selectedId);
    if (!location || (location.parentId === null && document.children.length === 1)) return;
    const next = removeNode(document.children, selectedId);
    commitDocument({ ...document, children: next });
    const nextSelectedId = location.parentId ?? next[Math.min(location.index, next.length - 1)]?.id ?? next[0]?.id ?? "";
    setSelectedId(nextSelectedId);
    if (restoreTreeFocus && nextSelectedId) focusTreeNode(nextSelectedId);
  };

  const moveSelected = (direction: "up" | "down") => {
    const children = direction === "up" ? moveNodeUp(document.children, selectedId) : moveNodeDown(document.children, selectedId);
    if (children !== document.children) commitDocument({ ...document, children });
  };

  const moveTreeNode = (id: string, parentId: string | null, insertionIndex: number) => {
    commitDocument((current) => {
      const children = moveNodeToParent(current.children, id, parentId, insertionIndex);
      return children === current.children ? current : { ...current, children };
    });
    setSelectedId(id);
  };

  const endTreeDrag = () => {
    setTreeDraggedId(null);
    setTreeDropTarget(null);
  };

  const focusTreeNode = (id: string) => {
    window.requestAnimationFrame(() => {
      const buttons = treeRef.current?.querySelectorAll<HTMLButtonElement>("[data-tree-node-id]");
      [...(buttons ?? [])].find((button) => button.dataset.treeNodeId === id)?.focus();
    });
  };

  const moveTreeNodeByKeyboard = (id: string, direction: "up" | "down" | "left" | "right") => {
    commitDocument((current) => {
      const children = moveNodeByArrow(current.children, id, direction);
      return children === current.children ? current : { ...current, children };
    });
    setSelectedId(id);
    focusTreeNode(id);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && key === "y") {
        event.preventDefault();
        redo();
      } else if (modifier && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (!modifier && !event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        removeSelected();
      }
    };
    window.document.addEventListener("keydown", handleShortcut);
    return () => window.document.removeEventListener("keydown", handleShortcut);
  });

  const exportPng = async () => {
    if (!artboardRef.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(artboardRef.current, { pixelRatio: 2, cacheBust: true });
    const link = window.document.createElement("a");
    link.download = `${document.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawstack"}.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadPayload = (payload: EngineV2ExportPayload) => {
    const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
    const link = window.document.createElement("a");
    link.download = payload.filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    const payload = createEngineV2PrintHtmlExport(document);
    const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
    const preview = window.open(url, "_blank", "noopener,noreferrer");
    if (!preview) downloadPayload(payload);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const generateDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || generating) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch("/api/ai/engine-v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: value, currentDocument: document }),
      });
      const body = await response.json() as { document?: EngineDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "Generation failed");
      commitDocument(body.document);
      setSelectedId(body.document.children[0]?.id ?? "");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden bg-[#E9ECE6] text-[#15171A] max-[700px]:[&_[data-direction=row]]:!flex-col max-[700px]:[&_[data-layout=grid]]:!grid-cols-1">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#CED3CA] bg-[#F7F8F4] lg:flex">
        <div className="border-b border-[#D7DBD2] px-4 py-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3157F6]">Engine v2 laboratory</div>
          <h1 className="mt-1 text-lg font-semibold tracking-[-0.035em]">A document, not a picture</h1>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Structure</span>
          <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold ${hydrated ? "bg-[#B7FF4A]" : "bg-[#E4E7E1]"}`}>{hydrated ? "LIVE DOM" : "CONNECTING"}</span>
        </div>
        <div ref={treeRef} className="min-h-0 flex-1 overflow-auto px-2 pb-4">
          <Tree nodes={document.children} selectedId={selectedId} draggedId={treeDraggedId} dropTarget={treeDropTarget} onSelect={setSelectedId} onDragStart={setTreeDraggedId} onDragEnd={endTreeDrag} onDropTarget={setTreeDropTarget} onMove={moveTreeNode} onKeyboardMove={moveTreeNodeByKeyboard} />
        </div>
        <button type="button" onClick={copyDocument} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-[#C8CEC4] bg-white px-3 py-2.5 text-xs font-semibold hover:border-[#3157F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3157F6]">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Document copied" : "Copy agent document"}
        </button>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto p-3 md:p-8">
        <form onSubmit={generateDocument} className="mx-auto mb-5 max-w-[1080px] rounded-xl border border-[#C8CEC4] bg-[#F7F8F4] p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="ml-2 shrink-0 text-[#3157F6]" />
            <input aria-label="Describe what to build" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none" placeholder="Describe the chart, graph, or visual you need" />
            <button type="submit" disabled={generating || !prompt.trim()} className="flex shrink-0 items-center gap-2 rounded-lg bg-[#15171A] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? "Compiling" : "Generate"}
            </button>
          </div>
          {generationError ? <p role="alert" className="px-3 pb-1 pt-2 text-xs text-[#B93815]">{generationError}</p> : null}
        </form>
        <div className="mx-auto mb-3 flex max-w-[1080px] items-center justify-between text-[#596159]">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]"><MousePointer2 size={13} /> Select any element to edit its real node</div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={undo} disabled={!past.length} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Undo"><Undo2 size={14} /></button>
            <button type="button" onClick={redo} disabled={!future.length} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Redo"><Redo2 size={14} /></button>
            <button type="button" onClick={resetDocument} className="rounded-md p-2 hover:bg-[#DDE1D9]" title="Reset sample"><RotateCcw size={14} /></button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importDocument(event.target.files?.[0])} />
            <button type="button" onClick={() => importRef.current?.click()} className="rounded-md p-2 hover:bg-[#DDE1D9]" title="Import Engine v2 JSON"><Upload size={14} /></button>
            <button type="button" onClick={() => setHistoryOpen(true)} disabled={!projectId} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Version history"><History size={14} /></button>
            <button type="button" onClick={saveDocument} disabled={saveState === "saving"} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9] disabled:opacity-50"><Save size={13} />{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : projectId ? "Save" : "Save project"}</button>
            <button type="button" onClick={shareDocument} disabled={shareState === "sharing"} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9] disabled:opacity-50"><Share2 size={13} />{shareState === "sharing" ? "Sharing" : shareState === "copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}</button>
            <button type="button" onClick={exportPng} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]"><Download size={13} /> Export PNG</button>
            <button type="button" onClick={() => downloadPayload(createEngineV2SvgExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">SVG</button>
            <button type="button" onClick={printPdf} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">PDF</button>
            <button type="button" onClick={() => downloadPayload(createEngineV2JsonExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">JSON</button>
            <button type="button" onClick={() => downloadPayload(createEngineV2ReactTsxExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]" title="Export a self-contained React component">TSX</button>
            <span className="ml-2 font-mono text-[10px]">1080 × auto</span>
          </div>
        </div>
        <div
          ref={artboardRef}
          className="mx-auto overflow-hidden shadow-[0_24px_70px_rgba(35,42,34,0.16)]"
          style={{ width: "100%", maxWidth: document.artboard.width, minHeight: document.artboard.minHeight, background: resolveToken(document.artboard.background, document.tokens) }}
        >
          {document.children.map((node) => <Node key={node.id} node={node} tokens={document.tokens} selectedId={selectedId} onSelect={setSelectedId} />)}
        </div>
      </section>

      <aside className="hidden w-[284px] shrink-0 overflow-auto border-l border-[#CED3CA] bg-[#F7F8F4] p-4 xl:block">
        <div className="mb-5 flex items-center gap-2"><Code2 size={15} /><h2 className="text-sm font-semibold">Computed node</h2></div>
        {selected ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#D7DBD2] bg-white p-3 font-mono text-[10px] leading-5 text-[#566057]">
              <div><span className="text-[#3157F6]">id</span> {selected.id}</div>
              <div><span className="text-[#3157F6]">type</span> {selected.type}</div>
              <div><span className="text-[#3157F6]">name</span> {selected.name}</div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => moveSelected("up")} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Move node up"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => moveSelected("down")} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Move node down"><ArrowDown size={14} /></button>
              <button type="button" onClick={duplicateSelected} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Duplicate node"><CopyPlus size={14} /></button>
              <button type="button" onClick={removeSelected} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 text-[#B93815] hover:border-[#B93815]" title="Delete node"><Trash2 size={14} /></button>
            </div>

            {selected.type === "text" ? (
              <label className="block">
                <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Text content</span>
                <textarea value={selected.content} onChange={(event) => updateSelected((node) => node.type === "text" ? { ...node, content: event.target.value } : node)} rows={4} className="w-full resize-none rounded-lg border border-[#C8CEC4] bg-white p-3 text-sm outline-none focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/15" />
              </label>
            ) : null}

            {selected.type === "metric" ? (
              <div className="space-y-3">
                {(["label", "value", "detail"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">{field}</span>
                    <input value={selected[field]} onChange={(event) => updateSelected((node) => node.type === "metric" ? { ...node, [field]: event.target.value } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                  </label>
                ))}
              </div>
            ) : null}

            {selected.type === "chart" ? (
              <label className="block">
                <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Chart family</span>
                <select value={selected.chartType} onChange={(event) => updateSelected((node) => node.type === "chart" ? { ...node, chartType: event.target.value as EngineChartNode["chartType"] } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                  {["bar", "line", "area", "donut", "scatter", "stacked-bar", "radar", "heatmap", "treemap", "funnel", "gauge", "candlestick"].map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            ) : null}

            {selected.type === "graph" ? (
              <label className="block">
                <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Graph direction</span>
                <select value={selected.graph.direction ?? "TB"} onChange={(event) => updateSelected((node) => node.type === "graph" ? { ...node, graph: { ...node.graph, direction: event.target.value as "TB" | "LR" } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                  <option value="TB">Top to bottom</option>
                  <option value="LR">Left to right</option>
                </select>
              </label>
            ) : null}

            {selected.type === "frame" ? (
              <>
                <label className="block">
                  <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Layout mode</span>
                  <select value={selected.layout.mode} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, mode: event.target.value as "flex" | "grid" } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                    <option value="flex">Flex</option>
                    <option value="grid">Grid</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Gap</span>
                    <input type="number" min="0" max="96" value={selected.layout.gap} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, gap: Number(event.target.value) } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                  </label>
                  <label>
                    <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Padding</span>
                    <input type="number" min="0" max="120" value={selected.layout.padding} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, padding: Number(event.target.value) } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selected.layout.mode === "grid" ? (
                    <label>
                      <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Columns</span>
                      <input type="number" min="1" max="6" value={selected.layout.columns ?? 1} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, columns: Number(event.target.value) } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                    </label>
                  ) : (
                    <label>
                      <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Direction</span>
                      <select value={selected.layout.direction ?? "row"} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, direction: event.target.value as "row" | "column" } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                        <option value="row">Row</option>
                        <option value="column">Column</option>
                      </select>
                    </label>
                  )}
                </div>
              </>
            ) : null}

            <div className="border-t border-[#D7DBD2] pt-4 text-xs leading-5 text-[#667067]">
              The browser computes this node’s final geometry. The model edits structure and intent, not raw pixel coordinates.
            </div>
          </div>
        ) : <p className="text-sm text-[#667067]">Select a node on the canvas or in the structure tree.</p>}
      </aside>
      {historyOpen ? (
        <section className="fixed right-5 top-[72px] z-[80] w-[320px] rounded-xl border border-[#C8CEC4] bg-[#F7F8F4] p-3 shadow-2xl" aria-label="Version history">
          <div className="flex items-center justify-between px-1 pb-3">
            <div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Version history</div><div className="mt-1 text-sm font-semibold">Restore a saved document</div></div>
            <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-md p-2 hover:bg-[#E4E7E1]" aria-label="Close version history"><X size={15} /></button>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-auto">
            {revisions.map((revision) => (
              <button key={revision.id} type="button" onClick={() => restoreRevision(revision.id)} className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-[#C8CEC4] hover:bg-white">
                <span className="text-xs font-medium">{revision.label || "Saved version"}</span>
                <span className="font-mono text-[9px] text-[#667067]">{new Date(revision.createdAt).toLocaleString()}</span>
              </button>
            ))}
            {!revisions.length ? <p className="px-3 py-6 text-center text-xs text-[#667067]">No saved versions yet.</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

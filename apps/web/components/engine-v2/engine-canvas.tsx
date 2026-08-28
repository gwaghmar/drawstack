"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ClipboardPaste, Code2, Copy, CopyPlus, Download, FileDown, GripVertical, History, Layers3, Loader2, MousePointer2, PanelRight, Plus, Redo2, RotateCcw, Save, Share2, Sparkles, Trash2, Undo2, Upload, Users, Wifi, WifiOff, X } from "lucide-react";
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
import { CHART_FAMILY_TYPES } from "@/lib/engine-v2/chart-registry";
import { createDefaultNode, type InsertableNodeType } from "@/lib/engine-v2/node-factory";
import { alignNodes, copyNodes, distributeNodes, duplicateNodes, findParent, insertNode, moveNodeByArrow, moveNodeDown, moveNodeToParent, moveNodeUp, pasteNodes, removeNodes, uniqueNodeId } from "@/lib/engine-v2/operations";
import { createEngineV2JsonExport, createEngineV2PrintHtmlExport, createEngineV2ReactTsxExport, createEngineV2SvgExport, type EngineV2ExportPayload } from "@/lib/engine-v2/export";
import { applyEngineDocumentTransaction, createEngineDocumentTransaction, type EngineTransactionOrigin } from "@/lib/engine-v2/transactions";
import { useEngineV2Collaboration } from "@/lib/hooks/use-engine-v2-collaboration";

const EMPTY_SELECTION = new Set<string>();

function Frame({ node, tokens, selectedIds = EMPTY_SELECTION, onSelect }: { node: EngineFrameNode; tokens: EngineTokens; selectedIds?: ReadonlySet<string>; onSelect: (id: string, additive: boolean) => void }) {
  const layout = node.layout;
  const layoutStyle = layout.mode === "grid"
    ? { display: "grid", gridTemplateColumns: `repeat(${layout.columns ?? 1}, minmax(0, 1fr))`, gap: layout.gap, padding: layout.padding, alignItems: layout.align, justifyContent: layout.justify }
    : { display: "flex", flexDirection: layout.direction ?? "row", gap: layout.gap, padding: layout.padding, alignItems: layout.align, justifyContent: layout.justify };

  return (
    <div
      data-node-id={node.id}
      data-node-type={node.type}
      data-layout={layout.mode}
      data-direction={layout.direction}
      onClick={(event) => { event.stopPropagation(); onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey); }}
      style={{ ...layoutStyle, ...nodeStyle(node.style, tokens), maxWidth: "100%" }}
      className={`relative box-border ${selectedIds.has(node.id) ? "outline outline-2 outline-offset-2 outline-[#3157F6]" : ""}`}
    >
      {node.children.map((child) => (
        <Node key={child.id} node={child} tokens={tokens} selectedIds={selectedIds} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Node({ node, tokens, selectedIds = EMPTY_SELECTION, onSelect }: { node: EngineNode; tokens: EngineTokens; selectedIds?: ReadonlySet<string>; onSelect: (id: string, additive: boolean) => void }) {
  if (node.type === "frame") return <Frame node={node} tokens={tokens} selectedIds={selectedIds} onSelect={onSelect} />;

  const selected = selectedIds.has(node.id);
  const shared = {
    "data-node-id": node.id,
    "data-node-type": node.type,
    onClick: (event: React.MouseEvent) => { event.stopPropagation(); onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey); },
    style: { ...nodeStyle(node.style, tokens), maxWidth: "100%" },
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

type SelectedBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ResizeSession = {
  axes: "width" | "height" | "both";
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  original: EngineDocument;
  changed: boolean;
};

type TreeProps = {
  nodes: EngineNode[];
  selectedId: string;
  selectedIds: ReadonlySet<string>;
  draggedId: string | null;
  dropTarget: TreeDropTarget | null;
  parentId?: string | null;
  depth?: number;
  onSelect: (id: string, additive: boolean) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTarget: (target: TreeDropTarget | null) => void;
  onMove: (id: string, parentId: string | null, insertionIndex: number) => void;
  onKeyboardMove: (id: string, direction: "up" | "down" | "left" | "right") => void;
};

function Tree({ nodes, selectedId, selectedIds = EMPTY_SELECTION, draggedId, dropTarget, parentId = null, depth = 0, onSelect, onDragStart, onDragEnd, onDropTarget, onMove, onKeyboardMove }: TreeProps) {
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
          <div key={node.id} className="relative" role="treeitem" aria-level={depth + 1} aria-selected={selectedIds.has(node.id)} aria-expanded={node.type === "frame" ? true : undefined}>
            {activePosition === "before" ? <div className="pointer-events-none absolute inset-x-1 -top-[2px] z-10 h-0.5 rounded-full bg-[#3157F6]" /> : null}
            <button
              type="button"
              onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
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
              className={`flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${draggedId === node.id ? "opacity-45" : ""} ${activePosition === "inside" ? "bg-[#DCE3FF] ring-1 ring-inset ring-[#3157F6]" : selectedIds.has(node.id) ? selectedId === node.id ? "bg-[#E9EDFF] text-[#2448D8] ring-1 ring-inset ring-[#3157F6]" : "bg-[#F0F2FF] text-[#2448D8]" : "text-[#566057] hover:bg-[#F0F2EC]"}`}
            >
              <GripVertical size={12} className="shrink-0 cursor-grab opacity-35" aria-hidden="true" />
              <span className="w-12 shrink-0 font-mono text-[9px] uppercase tracking-wide opacity-70">{node.type}</span>
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {node.type === "frame" ? <Tree nodes={node.children} selectedId={selectedId} selectedIds={selectedIds} draggedId={draggedId} dropTarget={dropTarget} parentId={node.id} depth={depth + 1} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropTarget={onDropTarget} onMove={onMove} onKeyboardMove={onKeyboardMove} /> : null}
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
      {document.children.map((node) => <Node key={node.id} node={node} tokens={document.tokens} selectedIds={EMPTY_SELECTION} onSelect={() => {}} />)}
    </div>
  );
}

export function EngineCanvas({ initialDocument = ENGINE_V2_SAMPLE, initialProjectId = null, initialUpdatedAt = null, initialPrompt = "Create a concise product launch dashboard with revenue, conversion, and channel performance", autoGenerate = false }: { initialDocument?: EngineDocument; initialProjectId?: string | null; initialUpdatedAt?: string | null; initialPrompt?: string; autoGenerate?: boolean }) {
  const router = useRouter();
  const [document, setDocument] = useState<EngineDocument>(initialDocument);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [past, setPast] = useState<EngineDocument[]>([]);
  const [future, setFuture] = useState<EngineDocument[]>([]);
  const [selectedId, setSelectedId] = useState("title");
  const [selectedIds, setSelectedIds] = useState<string[]>(["title"]);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [generating, setGenerating] = useState(false);
  const [aiComposerOpen, setAiComposerOpen] = useState(autoGenerate);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [hasPersistenceConflict, setHasPersistenceConflict] = useState(false);
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [openDrawer, setOpenDrawer] = useState<"layers" | "inspect" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "link-copied" | "embed-copied" | "error">("idle");
  const [treeDraggedId, setTreeDraggedId] = useState<string | null>(null);
  const [treeDropTarget, setTreeDropTarget] = useState<TreeDropTarget | null>(null);
  const [selectedBounds, setSelectedBounds] = useState<SelectedBounds | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [revisions, setRevisions] = useState<Array<{ id: string; label: string | null; createdAt: Date }>>([]);
  const artboardRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const clipboardNodesRef = useRef<EngineNode[]>([]);
  const documentRef = useRef(document);
  const selectedIdRef = useRef(selectedId);
  const autoGeneratedRef = useRef(false);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const layersButtonRef = useRef<HTMLButtonElement>(null);
  const inspectButtonRef = useRef<HTMLButtonElement>(null);
  const selected = useMemo(() => findNode(document.children, selectedId), [document, selectedId]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const storageKey = `drawstack.engine-v2.document.${projectId ?? "draft"}`;

  const closeDrawer = () => {
    const trigger = openDrawer === "layers" ? layersButtonRef.current : inspectButtonRef.current;
    setOpenDrawer(null);
    window.requestAnimationFrame(() => trigger?.focus());
  };

  useEffect(() => {
    if (!openDrawer) return;
    window.requestAnimationFrame(() => {
      window.document.querySelector<HTMLButtonElement>(`[data-engine-drawer="${openDrawer}"] [data-drawer-close]`)?.focus();
    });
  }, [openDrawer]);

  useEffect(() => {
    documentRef.current = document;
    selectedIdRef.current = selectedId;
  }, [document, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const saved = projectId ? null : window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as EngineDocument;
        if (parsed.version === 2 && parsed.engine === "dom-css") {
          queueMicrotask(() => {
            if (cancelled) return;
            documentRef.current = parsed;
            setDocument(parsed);
          });
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    queueMicrotask(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [projectId, storageKey]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(document));
  }, [document, hydrated, storageKey]);

  useEffect(() => {
    if (!projectId || !historyOpen) return;
    listEngineV2Revisions(projectId).then(setRevisions).catch(() => setRevisions([]));
  }, [historyOpen, projectId, saveState]);

  const collaboration = useEngineV2Collaboration({
    projectId,
    selectionId: selectedId,
    onRecords: (records, pending) => {
      const current = documentRef.current;
      let next = current;
      for (const record of records) {
        const candidate = applyEngineDocumentTransaction(next, record.transaction);
        const validated = validateEngineV2Document(candidate);
        if (!validated.ok) {
          setCollaborationError(`A remote edit was skipped: ${validated.issues[0]?.message ?? "invalid document"}`);
          continue;
        }
        next = validated.document;
      }
      for (const transaction of pending) next = applyEngineDocumentTransaction(next, transaction);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      documentRef.current = next;
      setDocument(next);
      setPast([]);
      setFuture([]);
      setSaveState("idle");
      if (!findNode(next.children, selectedIdRef.current)) {
        const nextSelectedId = next.children[0]?.id ?? "";
        setSelectedId(nextSelectedId);
        setSelectedIds(nextSelectedId ? [nextSelectedId] : []);
      }
    },
  });

  const commitDocument = (update: EngineDocument | ((current: EngineDocument) => EngineDocument), origin: EngineTransactionOrigin = "local") => {
    const current = documentRef.current;
    const requested = typeof update === "function" ? update(current) : update;
    const transaction = createEngineDocumentTransaction(current, requested, origin);
    if (!transaction.operations.length) return;
    const next = applyEngineDocumentTransaction(current, transaction);
    documentRef.current = next;
    setDocument(next);
    setPast((items) => [...items.slice(-49), current]);
    setFuture([]);
    setSaveState("idle");
    collaboration.publish(transaction);
  };

  const measureSelectedNode = () => {
    const artboard = artboardRef.current;
    if (!artboard || selectedIds.length !== 1) return setSelectedBounds(null);
    const element = [...artboard.querySelectorAll<HTMLElement>("[data-node-id]")]
      .find((candidate) => candidate.dataset.nodeId === selectedId);
    if (!element) return setSelectedBounds(null);
    const artboardBounds = artboard.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    setSelectedBounds({
      left: bounds.left - artboardBounds.left,
      top: bounds.top - artboardBounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  };

  useLayoutEffect(measureSelectedNode, [document, selectedId, selectedIds.length]);

  useEffect(() => {
    const artboard = artboardRef.current;
    if (!artboard) return;
    const observer = new ResizeObserver(measureSelectedNode);
    observer.observe(artboard);
    window.addEventListener("resize", measureSelectedNode);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureSelectedNode);
    };
  }, [selectedId, selectedIds.length]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const updateSelected = (update: (node: EngineNode) => EngineNode) => {
    commitDocument((current) => ({ ...current, children: mapNode(current.children, selectedId, update) }));
  };

  const selectNode = (id: string, additive: boolean) => {
    if (!additive) {
      setSelectedId(id);
      setSelectedIds([id]);
      return;
    }
    const included = selectedIds.includes(id);
    if (included && selectedIds.length === 1) return;
    const next = included ? selectedIds.filter((selectedNodeId) => selectedNodeId !== id) : [...selectedIds, id];
    setSelectedIds(next);
    setSelectedId(included && selectedId === id ? next.at(-1)! : id);
  };

  const replaceSelection = (ids: string[]) => {
    const next = ids.length ? ids : [document.children[0]?.id ?? ""];
    setSelectedIds(next.filter(Boolean));
    setSelectedId(next.at(-1) ?? "");
  };

  const copyDocument = async () => {
    await navigator.clipboard.writeText(JSON.stringify(document, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const resetDocument = () => {
    commitDocument(ENGINE_V2_SAMPLE);
    replaceSelection(["title"]);
    setGenerationError(null);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [document, ...items.slice(0, 49)]);
    const transaction = createEngineDocumentTransaction(documentRef.current, previous, "undo");
    const next = applyEngineDocumentTransaction(documentRef.current, transaction);
    documentRef.current = next;
    setDocument(next);
    collaboration.publish(transaction);
    setSaveState("idle");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-49), document]);
    const transaction = createEngineDocumentTransaction(documentRef.current, next, "redo");
    const applied = applyEngineDocumentTransaction(documentRef.current, transaction);
    documentRef.current = applied;
    setDocument(applied);
    collaboration.publish(transaction);
    setSaveState("idle");
  };

  const saveDocument = async () => {
    if (hasPersistenceConflict) return;
    setSaveState("saving");
    try {
      const currentDocument = documentRef.current;
      if (projectId) {
        if (!savedUpdatedAt) throw new Error("Missing project version");
        const result = await saveEngineV2Project(projectId, currentDocument.name, JSON.stringify(currentDocument), savedUpdatedAt, "Engine v2 save");
        if (!result.ok) {
          setHasPersistenceConflict(true);
          setSaveState("conflict");
          return;
        }
        setSavedUpdatedAt(result.updatedAt);
      } else {
        const created = await createEngineV2Project(currentDocument.name, JSON.stringify(currentDocument));
        setProjectId(created.id);
        setSavedUpdatedAt(created.updatedAt);
        router.replace(`/app/engine-v2?id=${created.id}`);
      }
      setHasPersistenceConflict(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const shareDocument = async (kind: "link" | "embed") => {
    setShareState("sharing");
    try {
      const currentDocument = documentRef.current;
      let id = projectId;
      if (id) {
        if (!savedUpdatedAt) throw new Error("Missing project version");
        const result = await saveEngineV2Project(id, currentDocument.name, JSON.stringify(currentDocument), savedUpdatedAt, "Shared version");
        if (!result.ok) {
          setHasPersistenceConflict(true);
          setSaveState("conflict");
          setShareState("idle");
          return;
        }
        setSavedUpdatedAt(result.updatedAt);
      }
      else {
        const created = await createEngineV2Project(currentDocument.name, JSON.stringify(currentDocument));
        id = created.id;
        setProjectId(created.id);
        setSavedUpdatedAt(created.updatedAt);
        router.replace(`/app/engine-v2?id=${created.id}`);
      }
      let preview: string | undefined;
      if (artboardRef.current) {
        try {
          const { toPng } = await import("html-to-image");
          preview = await toPng(artboardRef.current, { pixelRatio: 1, cacheBust: true });
        } catch {
          preview = undefined;
        }
      }
      const token = await createShareLink(id, preview);
      const sharedUrl = `${window.location.origin}/${kind === "embed" ? "embed" : "s"}/${token}`;
      const clipboardValue = kind === "embed"
        ? `<iframe src="${sharedUrl}" title="drawxyz visual" loading="lazy" style="width:100%;height:720px;border:0" allowfullscreen></iframe>`
        : sharedUrl;
      await navigator.clipboard.writeText(clipboardValue);
      setShareState(kind === "embed" ? "embed-copied" : "link-copied");
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
      commitDocument(result.document, "import");
      replaceSelection([result.document.children[0]?.id ?? ""]);
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
      if (!savedUpdatedAt) throw new Error("Missing project version");
      const restored = await restoreEngineV2Revision(projectId, revisionId, savedUpdatedAt);
      if (!restored.ok) {
        setHasPersistenceConflict(true);
        setSaveState("conflict");
        setHistoryOpen(false);
        return;
      }
      const result = validateEngineV2Document(JSON.parse(restored.source) as unknown);
      if (!result.ok) throw new Error("Stored revision is invalid");
      commitDocument(result.document, "restore");
      setSavedUpdatedAt(restored.updatedAt);
      setHasPersistenceConflict(false);
      replaceSelection([result.document.children[0]?.id ?? ""]);
      setHistoryOpen(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const duplicateSelected = () => {
    const restoreTreeFocus = treeRef.current?.contains(window.document.activeElement) ?? false;
    const result = duplicateNodes(document.children, selectedIds);
    if (result.nodes === document.children) return;
    commitDocument({ ...document, children: result.nodes });
    replaceSelection(result.duplicatedIds);
    if (restoreTreeFocus && result.duplicatedIds.length) focusTreeNode(result.duplicatedIds.at(-1)!);
  };

  const removeSelected = () => {
    const restoreTreeFocus = treeRef.current?.contains(window.document.activeElement) ?? false;
    const location = findParent(document.children, selectedIds[0] ?? selectedId);
    if (!location) return;
    const next = removeNodes(document.children, selectedIds);
    if (next === document.children) return;
    commitDocument({ ...document, children: next });
    const parentStillExists = location.parentId && findParent(next, location.parentId);
    const nextSelectedId = parentStillExists ? location.parentId! : next[Math.min(location.index, next.length - 1)]?.id ?? next[0]?.id ?? "";
    replaceSelection([nextSelectedId]);
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
    replaceSelection([id]);
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
    replaceSelection([id]);
    focusTreeNode(id);
  };

  const resizeSelectedNode = (source: EngineDocument, width: number | null, minHeight: number | null) => ({
    ...source,
    children: mapNode(source.children, selectedId, (node) => {
      const style = { ...node.style };
      if (width !== null) {
        style.width = Math.max(80, Math.min(source.artboard.width, Math.round(width)));
        delete style.flex;
      }
      if (minHeight !== null) style.minHeight = Math.max(40, Math.round(minHeight));
      return { ...node, style };
    }),
  });

  const beginResize = (event: React.PointerEvent<HTMLButtonElement>, axes: ResizeSession["axes"]) => {
    if (!selectedBounds) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    resizeSessionRef.current = {
      axes,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: selectedBounds.width,
      startHeight: selectedBounds.height,
      original: document,
      changed: false,
    };

    const move = (moveEvent: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      const width = session.axes === "width" || session.axes === "both" ? session.startWidth + moveEvent.clientX - session.startX : null;
      const minHeight = session.axes === "height" || session.axes === "both" ? session.startHeight + moveEvent.clientY - session.startY : null;
      if ((width === null || Math.round(width) === Math.round(session.startWidth)) && (minHeight === null || Math.round(minHeight) === Math.round(session.startHeight))) return;
      session.changed = true;
      const current = documentRef.current;
      const requested = resizeSelectedNode(session.original, width, minHeight);
      const next = applyEngineDocumentTransaction(current, createEngineDocumentTransaction(current, requested, "local"));
      documentRef.current = next;
      setDocument(next);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      resizeCleanupRef.current = null;
    };
    const end = () => {
      const session = resizeSessionRef.current;
      resizeSessionRef.current = null;
      cleanup();
      if (!session?.changed) return;
      collaboration.publish(createEngineDocumentTransaction(session.original, documentRef.current, "local"));
      setPast((items) => [...items.slice(-49), session.original]);
      setFuture([]);
      setSaveState("idle");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    resizeCleanupRef.current = cleanup;
  };

  const updateSelectedDimension = (property: "width" | "minHeight", rawValue: string) => {
    updateSelected((node) => {
      const style = { ...node.style };
      if (!rawValue) delete style[property];
      else style[property] = Math.min(property === "width" ? document.artboard.width : Number.POSITIVE_INFINITY, Math.max(property === "width" ? 80 : 40, Math.round(Number(rawValue))));
      if (property === "width" && rawValue) delete style.flex;
      return { ...node, style };
    });
  };

  const alignSelection = (alignment: "start" | "center" | "end" | "stretch") => {
    commitDocument((current) => {
      const children = alignNodes(current.children, selectedIds, alignment);
      return children === current.children ? current : { ...current, children };
    });
  };

  const distributeSelection = (distribution: "packed" | "between" | "around" | "evenly") => {
    commitDocument((current) => {
      const children = distributeNodes(current.children, selectedIds, distribution);
      return children === current.children ? current : { ...current, children };
    });
  };

  const selectionSharesFrame = useMemo(() => {
    if (selectedIds.length < 2) return false;
    const locations = selectedIds.map((id) => findParent(document.children, id));
    const parentId = locations[0]?.parentId;
    return parentId !== null && parentId !== undefined && locations.every((location) => location?.parentId === parentId);
  }, [document.children, selectedIds]);

  const insertionTarget = () => {
    const location = findParent(document.children, selectedId);
    if (!location) return { parentId: null, index: document.children.length };
    if (location.node.type === "frame") return { parentId: location.node.id, index: location.node.children.length };
    return { parentId: location.parentId, index: location.index + 1 };
  };

  const addNode = (type: InsertableNodeType) => {
    const id = uniqueNodeId(document.children, type);
    const node = createDefaultNode(type, id);
    const target = insertionTarget();
    const children = insertNode(document.children, node, target.parentId, target.index);
    commitDocument({ ...document, children });
    replaceSelection([id]);
    setAddMenuOpen(false);
  };

  const copySelection = () => {
    const copied = copyNodes(document.children, selectedIds);
    if (!copied.length) return;
    clipboardNodesRef.current = copied;
    setClipboardCount(copied.length);
    navigator.clipboard?.writeText(`drawstack-engine-v2:${JSON.stringify(copied)}`).catch(() => {});
  };

  const pasteSelection = () => {
    const target = insertionTarget();
    const result = pasteNodes(document.children, clipboardNodesRef.current, target.parentId, target.index);
    if (result.nodes === document.children) return;
    commitDocument({ ...document, children: result.nodes });
    replaceSelection(result.pastedIds);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.key === "Escape" && openDrawer) {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key === "Escape" && aiComposerOpen) {
        event.preventDefault();
        setAiComposerOpen(false);
        return;
      }
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
      } else if (modifier && key === "c") {
        event.preventDefault();
        copySelection();
      } else if (modifier && key === "v") {
        event.preventDefault();
        pasteSelection();
      } else if (modifier && key === "a") {
        event.preventDefault();
        const location = findParent(document.children, selectedId);
        if (location) replaceSelection((location.parent?.children ?? document.children).map((node) => node.id));
      } else if (!modifier && !event.altKey && event.key === "Escape" && selectedIds.length > 1) {
        event.preventDefault();
        replaceSelection([selectedId]);
      } else if (!modifier && !event.altKey && event.key === "Escape" && addMenuOpen) {
        event.preventDefault();
        setAddMenuOpen(false);
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
        body: JSON.stringify({ prompt: value, currentDocument: documentRef.current }),
      });
      const body = await response.json() as { document?: EngineDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "Generation failed");
      commitDocument(body.document, "ai");
      replaceSelection([body.document.children[0]?.id ?? ""]);
      setAiComposerOpen(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Generation failed");
      setAiComposerOpen(true);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!autoGenerate || autoGeneratedRef.current || !initialPrompt.trim()) return;
    autoGeneratedRef.current = true;
    queueMicrotask(() => generateButtonRef.current?.click());
  }, [autoGenerate, initialPrompt]);

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden bg-[#E9ECE6] text-[#15171A] max-[700px]:[&_[data-direction=row]]:!flex-col max-[700px]:[&_[data-layout=grid]]:!grid-cols-1">
      <aside data-engine-drawer="layers" className={`${openDrawer === "layers" ? "fixed inset-y-0 left-0 z-[90] flex shadow-2xl" : "hidden"} w-[min(88vw,320px)] shrink-0 flex-col border-r border-[#CED3CA] bg-[#F7F8F4] lg:static lg:z-auto lg:flex lg:w-[248px] lg:shadow-none`}>
        <div className="border-b border-[#D7DBD2] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div><div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3157F6]">Engine v2 laboratory</div><h1 className="mt-1 text-lg font-semibold tracking-[-0.035em]">A document, not a picture</h1></div>
            <button type="button" data-drawer-close onClick={closeDrawer} className="rounded-md p-2 hover:bg-[#E4E7E1] lg:hidden" aria-label="Close layers"><X size={16} /></button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">{selectedIds.length > 1 ? `${selectedIds.length} nodes selected` : "Structure"}</span>
          <div className="relative flex items-center gap-1.5">
            <button type="button" onClick={() => setAddMenuOpen((open) => !open)} aria-label="Add node" aria-haspopup="menu" aria-expanded={addMenuOpen} className="flex items-center gap-1 rounded-md border border-[#C8CEC4] bg-white px-2 py-1 font-mono text-[9px] font-semibold hover:border-[#3157F6]"><Plus size={11} />Add</button>
            <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold ${hydrated ? "bg-[#B7FF4A]" : "bg-[#E4E7E1]"}`}>{hydrated ? "LIVE DOM" : "CONNECTING"}</span>
            {addMenuOpen ? (
              <div role="menu" aria-label="Add node type" className="absolute right-0 top-8 z-[70] w-40 rounded-lg border border-[#C8CEC4] bg-white p-1.5 shadow-xl">
                {(["text", "metric", "frame", "chart", "graph"] as const).map((type) => (
                  <button key={type} type="button" role="menuitem" onClick={() => addNode(type)} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs capitalize hover:bg-[#E9EDFF] hover:text-[#2448D8]"><span>{type}</span><span className="font-mono text-[8px] uppercase text-[#667067]">new</span></button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div ref={treeRef} className="min-h-0 flex-1 overflow-auto px-2 pb-4">
          <Tree nodes={document.children} selectedId={selectedId} selectedIds={selectedIdSet} draggedId={treeDraggedId} dropTarget={treeDropTarget} onSelect={selectNode} onDragStart={setTreeDraggedId} onDragEnd={endTreeDrag} onDropTarget={setTreeDropTarget} onMove={moveTreeNode} onKeyboardMove={moveTreeNodeByKeyboard} />
        </div>
        <button type="button" onClick={copyDocument} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-[#C8CEC4] bg-white px-3 py-2.5 text-xs font-semibold hover:border-[#3157F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3157F6]">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Document copied" : "Copy agent document"}
        </button>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto p-3 md:p-8">
        {hasPersistenceConflict ? (
          <div role="alert" className="mx-auto mb-4 flex max-w-[1080px] items-center justify-between gap-4 rounded-lg border border-[#E6A23C] bg-[#FFF8E8] px-4 py-3 text-xs text-[#6E4A00]">
            <span className="flex items-center gap-2"><AlertTriangle size={15} />This project changed elsewhere. Your local edits were not overwritten.</span>
            <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-md border border-[#D39A38] bg-white px-3 py-1.5 font-semibold hover:bg-[#FFF1CE]">Load latest version</button>
          </div>
        ) : null}
        {collaboration.conflicts.length ? (
          <div role="alert" className="mx-auto mb-4 flex max-w-[1080px] items-center justify-between gap-4 rounded-lg border border-[#D98A76] bg-[#FFF0EC] px-4 py-3 text-xs text-[#7A2E1D]">
            <span className="flex items-center gap-2"><AlertTriangle size={15} />Concurrent edits touched the same field: {collaboration.conflicts.at(-1)?.keys.join(", ")}. Server order is shown. Review before saving.</span>
            <button type="button" onClick={collaboration.dismissConflicts} className="shrink-0 rounded-md border border-[#D98A76] bg-white px-3 py-1.5 font-semibold hover:bg-[#FFE4DC]">Dismiss</button>
          </div>
        ) : null}
        {collaborationError ? (
          <div role="alert" className="mx-auto mb-4 flex max-w-[1080px] items-center justify-between gap-4 rounded-lg border border-[#D98A76] bg-[#FFF0EC] px-4 py-3 text-xs text-[#7A2E1D]">
            <span className="flex items-center gap-2"><AlertTriangle size={15} />{collaborationError}</span>
            <button type="button" onClick={() => setCollaborationError(null)} className="shrink-0 rounded-md border border-[#D98A76] bg-white px-3 py-1.5 font-semibold hover:bg-[#FFE4DC]">Dismiss</button>
          </div>
        ) : null}
        <div className="mx-auto mb-3 flex max-w-[1080px] min-w-0 flex-col gap-2 text-[#596159] 2xl:flex-row 2xl:items-center 2xl:justify-between" data-engine-toolbar>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] md:flex"><MousePointer2 size={13} /> Select any element to edit its real node</div>
          <div className="flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-1 2xl:w-auto 2xl:pb-0">
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#CED3CA] bg-[#F7F8F4] p-1">
              <button type="button" onClick={() => setAiComposerOpen(true)} aria-label="Open AI composer" className="flex items-center gap-1.5 rounded-md bg-[#15171A] px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#2B2E33]"><Sparkles size={13} />AI</button>
              <button ref={layersButtonRef} type="button" onClick={() => setOpenDrawer("layers")} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] hover:bg-[#E4E7E1] lg:hidden" aria-label="Open layers"><Layers3 size={13} />Layers</button>
              <button ref={inspectButtonRef} type="button" onClick={() => setOpenDrawer("inspect")} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] hover:bg-[#E4E7E1] xl:hidden" aria-label="Open inspector"><PanelRight size={13} />Inspect</button>
            </div>
            {projectId ? (
              <button type="button" onClick={() => collaboration.status === "offline" ? void collaboration.retry() : undefined} className="mr-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] hover:bg-[#DDE1D9]" title={collaboration.status === "offline" ? "Reconnect collaboration" : "Authenticated project collaboration"}>
                {collaboration.status === "offline" ? <WifiOff size={13} className="text-[#B93815]" /> : <Wifi size={13} className={collaboration.status === "synced" ? "text-[#27834F]" : "text-[#B87912]"} />}
                {collaboration.status === "synced" ? "Live" : collaboration.status === "offline" ? "Offline" : "Syncing"}
                <Users size={12} />{collaboration.presence.length + 1}
                <span className="flex -space-x-1">
                  {collaboration.presence.slice(0, 3).map((entry) => <span key={entry.sessionId} className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: entry.color }} title={`Editing ${entry.selectionId ?? "document"}`} />)}
                </span>
              </button>
            ) : null}
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#CED3CA] bg-[#F7F8F4] p-1">
              <button type="button" onClick={undo} disabled={!past.length} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Undo"><Undo2 size={14} /></button>
              <button type="button" onClick={redo} disabled={!future.length} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Redo"><Redo2 size={14} /></button>
              <button type="button" onClick={resetDocument} className="rounded-md p-2 hover:bg-[#DDE1D9]" title="Reset sample"><RotateCcw size={14} /></button>
            </div>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importDocument(event.target.files?.[0])} />
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#CED3CA] bg-[#F7F8F4] p-1">
              <button type="button" onClick={() => importRef.current?.click()} className="rounded-md p-2 hover:bg-[#DDE1D9]" title="Import Engine v2 JSON"><Upload size={14} /></button>
              <button type="button" onClick={() => setHistoryOpen(true)} disabled={!projectId} className="rounded-md p-2 hover:bg-[#DDE1D9] disabled:opacity-30" title="Version history"><History size={14} /></button>
              <button type="button" onClick={saveDocument} disabled={saveState === "saving" || hasPersistenceConflict} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9] disabled:opacity-50"><Save size={13} />{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "conflict" ? "Reload required" : saveState === "error" ? "Save failed" : projectId ? "Save" : "Save project"}</button>
              <button type="button" onClick={() => shareDocument("link")} disabled={shareState === "sharing"} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9] disabled:opacity-50"><Share2 size={13} />{shareState === "sharing" ? "Sharing" : shareState === "link-copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}</button>
              <button type="button" onClick={() => shareDocument("embed")} disabled={shareState === "sharing"} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9] disabled:opacity-50"><Code2 size={13} />{shareState === "sharing" ? "Preparing" : shareState === "embed-copied" ? "Embed copied" : shareState === "error" ? "Embed failed" : "Embed"}</button>
            </div>
            <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-[#CED3CA] bg-[#F7F8F4] p-1 xl:flex">
              <button type="button" onClick={exportPng} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]"><Download size={13} />PNG</button>
              <button type="button" onClick={() => downloadPayload(createEngineV2SvgExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">SVG</button>
              <button type="button" onClick={printPdf} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">PDF</button>
              <button type="button" onClick={() => downloadPayload(createEngineV2JsonExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]">JSON</button>
              <button type="button" onClick={() => downloadPayload(createEngineV2ReactTsxExport(document))} className="rounded-md px-2 py-1.5 font-mono text-[10px] hover:bg-[#DDE1D9]" title="Export a self-contained React component">TSX</button>
            </div>
            <details className="group relative shrink-0 xl:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[#CED3CA] bg-[#F7F8F4] px-2.5 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] hover:bg-[#E4E7E1]"><FileDown size={13} />Export</summary>
              <div className="absolute right-0 top-10 z-[75] grid w-36 rounded-lg border border-[#C8CEC4] bg-[#F7F8F4] p-1.5 shadow-xl">
                <button type="button" onClick={exportPng} className="rounded-md px-3 py-2 text-left text-xs hover:bg-[#E4E7E1]">PNG</button>
                <button type="button" onClick={() => downloadPayload(createEngineV2SvgExport(document))} className="rounded-md px-3 py-2 text-left text-xs hover:bg-[#E4E7E1]">SVG</button>
                <button type="button" onClick={printPdf} className="rounded-md px-3 py-2 text-left text-xs hover:bg-[#E4E7E1]">PDF</button>
                <button type="button" onClick={() => downloadPayload(createEngineV2JsonExport(document))} className="rounded-md px-3 py-2 text-left text-xs hover:bg-[#E4E7E1]">JSON</button>
                <button type="button" onClick={() => downloadPayload(createEngineV2ReactTsxExport(document))} className="rounded-md px-3 py-2 text-left text-xs hover:bg-[#E4E7E1]">React TSX</button>
              </div>
            </details>
            <span className="shrink-0 px-2 font-mono text-[10px]">1080 × auto</span>
          </div>
        </div>
        <div
          ref={artboardRef}
          className="relative mx-auto overflow-hidden shadow-[0_24px_70px_rgba(35,42,34,0.16)]"
          style={{ width: "100%", maxWidth: document.artboard.width, minHeight: document.artboard.minHeight, background: resolveToken(document.artboard.background, document.tokens) }}
        >
          {document.children.map((node) => <Node key={node.id} node={node} tokens={document.tokens} selectedIds={selectedIdSet} onSelect={selectNode} />)}
          {selectedBounds ? (
            <div
              className="pointer-events-none absolute z-50 border border-[#3157F6]"
              style={{ left: selectedBounds.left, top: selectedBounds.top, width: selectedBounds.width, height: selectedBounds.height }}
              data-selection-box={selectedId}
            >
              <button type="button" aria-label="Resize selected node width" onPointerDown={(event) => beginResize(event, "width")} className="pointer-events-auto absolute -right-2 top-1/2 h-10 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[#3157F6] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157F6]" />
              <button type="button" aria-label="Resize selected node minimum height" onPointerDown={(event) => beginResize(event, "height")} className="pointer-events-auto absolute -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-white bg-[#3157F6] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157F6]" />
              <button type="button" aria-label="Resize selected node width and minimum height" onPointerDown={(event) => beginResize(event, "both")} className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-[#3157F6] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157F6]" />
            </div>
          ) : null}
        </div>
      </section>

      <aside data-engine-drawer="inspect" className={`${openDrawer === "inspect" ? "fixed inset-y-0 right-0 z-[90] block shadow-2xl" : "hidden"} w-[min(92vw,360px)] shrink-0 overflow-auto border-l border-[#CED3CA] bg-[#F7F8F4] p-4 xl:static xl:z-auto xl:block xl:w-[284px] xl:shadow-none`}>
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Code2 size={15} /><h2 className="text-sm font-semibold">{selectedIds.length > 1 ? `${selectedIds.length} selected nodes` : "Computed node"}</h2></div>
          <button type="button" data-drawer-close onClick={closeDrawer} className="rounded-md p-2 hover:bg-[#E4E7E1] xl:hidden" aria-label="Close inspector"><X size={16} /></button>
        </div>
        {selected ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#D7DBD2] bg-white p-3 font-mono text-[10px] leading-5 text-[#566057]">
              <div><span className="text-[#3157F6]">id</span> {selected.id}</div>
              <div><span className="text-[#3157F6]">type</span> {selected.type}</div>
              <label className="mt-2 block">
                <span className="mb-1 block text-[#3157F6]">name</span>
                <input aria-label="Node name" value={selected.name} onChange={(event) => updateSelected((node) => ({ ...node, name: event.target.value }))} className="w-full rounded-md border border-[#C8CEC4] bg-white px-2 py-1.5 font-sans text-xs outline-none focus:border-[#3157F6]" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => moveSelected("up")} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Move node up"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => moveSelected("down")} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Move node down"><ArrowDown size={14} /></button>
              <button type="button" onClick={duplicateSelected} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Duplicate node"><CopyPlus size={14} /></button>
              <button type="button" onClick={copySelection} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6]" title="Copy selected nodes"><Copy size={14} /></button>
              <button type="button" onClick={pasteSelection} disabled={!clipboardCount} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 hover:border-[#3157F6] disabled:cursor-not-allowed disabled:opacity-35" title="Paste nodes"><ClipboardPaste size={14} /></button>
              <button type="button" onClick={removeSelected} className="flex items-center justify-center rounded-lg border border-[#D7DBD2] bg-white p-2.5 text-[#B93815] hover:border-[#B93815]" title="Delete node"><Trash2 size={14} /></button>
            </div>

            {selectedIds.length > 1 ? (
              <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3">
                <legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Align and distribute</legend>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["start", "center", "end", "stretch"] as const).map((alignment) => (
                    <button key={alignment} type="button" disabled={!selectionSharesFrame} onClick={() => alignSelection(alignment)} className="rounded-md border border-[#D7DBD2] px-1.5 py-2 text-[10px] capitalize hover:border-[#3157F6] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Align selected nodes ${alignment}`}>{alignment}</button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {(["packed", "between", "evenly"] as const).map((distribution) => (
                    <button key={distribution} type="button" disabled={!selectionSharesFrame} onClick={() => distributeSelection(distribution)} className="rounded-md border border-[#D7DBD2] px-1.5 py-2 text-[10px] capitalize hover:border-[#3157F6] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Distribute selected nodes ${distribution}`}>{distribution}</button>
                  ))}
                </div>
                {!selectionSharesFrame ? <p className="mt-2 text-[10px] leading-4 text-[#9A531C]">Choose nodes inside the same frame to align or distribute them.</p> : null}
              </fieldset>
            ) : null}

            <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3">
              <legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Responsive size</legend>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-2 block text-xs text-[#667067]">Width</span>
                  <input aria-label="Node width" type="number" min="80" max={document.artboard.width} placeholder="Auto" value={typeof selected.style?.width === "number" ? selected.style.width : ""} onChange={(event) => updateSelectedDimension("width", event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                </label>
                <label>
                  <span className="mb-2 block text-xs text-[#667067]">Min height</span>
                  <input aria-label="Node minimum height" type="number" min="40" placeholder="Auto" value={selected.style?.minHeight ?? ""} onChange={(event) => updateSelectedDimension("minHeight", event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                </label>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#667067]">Auto keeps the node fluid. A width stays inside layout flow.</p>
            </fieldset>

            <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3">
              <legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Appearance</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["background", "color", "borderColor"] as const).map((property) => (
                  <label key={property} className={property === "borderColor" ? "col-span-2" : ""}>
                    <span className="mb-1 block text-xs capitalize text-[#667067]">{property.replace(/([A-Z])/g, " $1")}</span>
                    <input aria-label={`Node ${property}`} placeholder="Default or $token" value={selected.style?.[property] ?? ""} onChange={(event) => updateSelected((node) => {
                      const style = { ...node.style };
                      if (event.target.value) style[property] = event.target.value;
                      else delete style[property];
                      return { ...node, style };
                    })} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" />
                  </label>
                ))}
                <label>
                  <span className="mb-1 block text-xs text-[#667067]">Border width</span>
                  <input aria-label="Node border width" type="number" min="0" max="24" placeholder="0" value={selected.style?.borderWidth ?? ""} onChange={(event) => updateSelected((node) => ({ ...node, style: { ...node.style, borderWidth: event.target.value ? Number(event.target.value) : undefined } }))} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-[#667067]">Radius</span>
                  <input aria-label="Node border radius" type="number" min="0" max="999" placeholder="Default" value={selected.style?.borderRadius ?? ""} onChange={(event) => updateSelected((node) => ({ ...node, style: { ...node.style, borderRadius: event.target.value ? Number(event.target.value) : undefined } }))} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-[#667067]">Flex grow</span>
                  <input aria-label="Node flex grow" type="number" min="0" max="12" placeholder="None" value={selected.style?.flex ?? ""} onChange={(event) => updateSelected((node) => ({ ...node, style: { ...node.style, flex: event.target.value ? Number(event.target.value) : undefined } }))} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-[#667067]">Self alignment</span>
                  <select aria-label="Node self alignment" value={selected.style?.alignSelf ?? ""} onChange={(event) => updateSelected((node) => ({ ...node, style: { ...node.style, alignSelf: event.target.value ? event.target.value as NonNullable<EngineNode["style"]>["alignSelf"] : undefined } }))} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]">
                    <option value="">Auto</option><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="stretch">Stretch</option>
                  </select>
                </label>
              </div>
            </fieldset>

            {selected.type === "text" ? (
              <div className="space-y-3">
                <label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Text style</span><select aria-label="Text style" value={selected.variant} onChange={(event) => updateSelected((node) => node.type === "text" ? { ...node, variant: event.target.value as typeof selected.variant } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]"><option value="eyebrow">Eyebrow</option><option value="display">Display</option><option value="heading">Heading</option><option value="body">Body</option><option value="caption">Caption</option></select></label>
                <label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Text content</span><textarea aria-label="Text content" value={selected.content} onChange={(event) => updateSelected((node) => node.type === "text" ? { ...node, content: event.target.value } : node)} rows={4} className="w-full resize-none rounded-lg border border-[#C8CEC4] bg-white p-3 text-sm outline-none focus:border-[#3157F6] focus:ring-2 focus:ring-[#3157F6]/15" /></label>
              </div>
            ) : null}

            {selected.type === "metric" ? (
              <div className="space-y-3">
                {(["label", "value", "detail"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">{field}</span>
                    <input value={selected[field]} onChange={(event) => updateSelected((node) => node.type === "metric" ? { ...node, [field]: event.target.value } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" />
                  </label>
                ))}
                <label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Tone</span><select aria-label="Metric tone" value={selected.tone} onChange={(event) => updateSelected((node) => node.type === "metric" ? { ...node, tone: event.target.value as typeof selected.tone } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]"><option value="neutral">Neutral</option><option value="positive">Positive</option><option value="warning">Warning</option></select></label>
              </div>
            ) : null}

            {selected.type === "chart" ? (
              <div className="space-y-3"><label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Chart title</span><input aria-label="Chart title" value={selected.title} onChange={(event) => updateSelected((node) => node.type === "chart" ? { ...node, title: event.target.value } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label><label className="block">
                <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Chart family</span>
                <select value={selected.chartType} onChange={(event) => updateSelected((node) => node.type === "chart" ? { ...node, chartType: event.target.value as EngineChartNode["chartType"] } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                  {CHART_FAMILY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label><div className="grid grid-cols-2 gap-3"><label><span className="mb-2 block text-xs text-[#667067]">Value prefix</span><input aria-label="Chart value prefix" value={selected.valuePrefix ?? ""} onChange={(event) => updateSelected((node) => node.type === "chart" ? { ...node, valuePrefix: event.target.value || undefined } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label><label><span className="mb-2 block text-xs text-[#667067]">Value suffix</span><input aria-label="Chart value suffix" value={selected.valueSuffix ?? ""} onChange={(event) => updateSelected((node) => node.type === "chart" ? { ...node, valueSuffix: event.target.value || undefined } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label></div><label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Chart data JSON</span><textarea key={`${selected.id}-data`} aria-label="Chart data JSON" defaultValue={JSON.stringify(selected.data, null, 2)} onBlur={(event) => { try { const data = JSON.parse(event.target.value); if (!Array.isArray(data)) throw new Error(); updateSelected((node) => node.type === "chart" ? { ...node, data } : node); setGenerationError(null); } catch { setGenerationError("Chart data must be a valid JSON array."); } }} rows={8} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-3 font-mono text-[11px] outline-none focus:border-[#3157F6]" /></label></div>
            ) : null}

            {selected.type === "graph" ? (
              <div className="space-y-3"><label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Graph title</span><input aria-label="Graph title" value={selected.title} onChange={(event) => updateSelected((node) => node.type === "graph" ? { ...node, title: event.target.value } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label><label className="block">
                <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Graph direction</span>
                <select value={selected.graph.direction ?? "TB"} onChange={(event) => updateSelected((node) => node.type === "graph" ? { ...node, graph: { ...node.graph, direction: event.target.value as "TB" | "LR" } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]">
                  <option value="TB">Top to bottom</option>
                  <option value="LR">Left to right</option>
                </select>
              </label><label className="block"><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Graph nodes and edges JSON</span><textarea key={`${selected.id}-graph`} aria-label="Graph data JSON" defaultValue={JSON.stringify(selected.graph, null, 2)} onBlur={(event) => { try { const graph = JSON.parse(event.target.value); if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error(); updateSelected((node) => node.type === "graph" ? { ...node, graph } : node); setGenerationError(null); } catch { setGenerationError("Graph data must contain valid nodes and edges arrays."); } }} rows={10} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-3 font-mono text-[11px] outline-none focus:border-[#3157F6]" /></label></div>
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
                <div className="grid grid-cols-2 gap-3">
                  <label><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Align</span><select aria-label="Frame alignment" value={selected.layout.align ?? "stretch"} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, align: event.target.value as EngineFrameNode["layout"]["align"] } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]"><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="stretch">Stretch</option></select></label>
                  <label><span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Justify</span><select aria-label="Frame justification" value={selected.layout.justify ?? "flex-start"} onChange={(event) => updateSelected((node) => node.type === "frame" ? { ...node, layout: { ...node.layout, justify: event.target.value as EngineFrameNode["layout"]["justify"] } } : node)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]"><option value="flex-start">Start</option><option value="center">Center</option><option value="flex-end">End</option><option value="space-between">Space between</option><option value="space-around">Space around</option><option value="space-evenly">Space evenly</option></select></label>
                </div>
              </>
            ) : null}

            <div className="border-t border-[#D7DBD2] pt-4 text-xs leading-5 text-[#667067]">
              The browser computes this node’s final geometry. The model edits structure and intent, not raw pixel coordinates.
            </div>
          </div>
        ) : <p className="text-sm text-[#667067]">Select a node on the canvas or in the structure tree.</p>}
      </aside>
      {openDrawer === "layers" ? <button type="button" aria-label="Close layers backdrop" onClick={closeDrawer} className="fixed inset-0 z-[85] bg-[#15171A]/30 lg:hidden" /> : null}
      {openDrawer === "inspect" ? <button type="button" aria-label="Close inspector backdrop" onClick={closeDrawer} className="fixed inset-0 z-[85] bg-[#15171A]/30 xl:hidden" /> : null}
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
      {aiComposerOpen ? (
        <form onSubmit={generateDocument} aria-label="AI visual composer" className="fixed bottom-4 left-1/2 z-[100] w-[min(calc(100vw-24px),760px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#15171A]/92 p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:bottom-6 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"><Sparkles size={13} />Build with AI</div>
            <button type="button" onClick={() => setAiComposerOpen(false)} aria-label="Close AI composer" className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-2 focus-within:border-white/30">
            <textarea autoFocus aria-label="Describe what to build" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); generateButtonRef.current?.click(); } }} rows={2} className="min-h-[58px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white outline-none placeholder:text-white/40" placeholder="Describe the chart, graph, or visual you need" />
            <button ref={generateButtonRef} type="submit" disabled={generating || !prompt.trim()} className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white px-3 py-2.5 text-xs font-semibold text-[#15171A] hover:bg-[#F0F2ED] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{generating ? "Compiling" : "Create"}</span>
            </button>
          </div>
          {generationError ? (
            <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 pt-3 text-xs text-[#FFB59F]">
              <span>{generationError}</span>
              {generationError.toLowerCase().includes("credit") ? <span className="flex items-center gap-2"><Link href="/app/settings" className="font-semibold text-white underline underline-offset-2">Add AI key</Link><Link href="/app/billing" className="font-semibold text-white underline underline-offset-2">Upgrade</Link></span> : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Circle, Copy, Download, Frame, Image as ImageIcon, Layers3, Minus, MousePointer2, PanelRight, Pen, Plus, Redo2, Save, Share2, Square, Trash2, Type, Undo2, Upload, X } from "lucide-react";
import { createEngineV2Project, saveEngineV2Project } from "@/app/actions/engine-v2";
import { createShareLink } from "@/app/actions/share";
import { EngineDocumentView } from "@/components/engine-v2/engine-canvas";
import type { EngineDocumentV3, Page } from "@/lib/engine-v3/document";
import type { EngineNode } from "@/lib/engine-v3/document";
import { duplicatePage as duplicateV3Page, removePage as removeV3Page } from "@/lib/engine-v3/operations";
import { findEngineV3Node, patchEngineV3Node } from "@/lib/engine-v3/node-operations";
import { defineComponent } from "@/lib/engine-v3/components";
import { createEngineV3JsonExport, createEngineV3PageExports, inlineEngineV3Assets, type EngineV3ExportPayload } from "@/lib/engine-v3/export";
import { serializeEngineV3Document } from "@/lib/engine-v3/serialization";
import { createEngineV3PageView } from "@/lib/engine-v3/view-adapter";
import { EngineV3HistoryController } from "@/lib/engine-v3/history";
import type { EngineV3Command } from "@/lib/engine-v3/commands";
import type { StoredAsset } from "@/lib/engine-v3/asset-storage";
import { dragEngineV3Node, engineV3NodeParentOffset } from "@/lib/engine-v3/canvas-gestures";
import type { SnapGuide } from "@/lib/engine-v3/snapping";
import { useEngineV3Collaboration } from "@/lib/hooks/use-engine-v3-collaboration";
import { reconcileRemoteCommand, type ReconciliationConflict } from "@/lib/engine-v3/reconciliation";

export type EngineV3CanvasProps = {
  initialDocument: EngineDocumentV3;
  initialProjectId?: string | null;
  initialUpdatedAt?: string | null;
  onDocumentChange?: (document: EngineDocumentV3) => void;
};

const pageName = (pages: Page[], base: string) => {
  const names = new Set(pages.map((page) => page.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(base + " " + index)) index += 1;
  return base + " " + index;
};

function LayerTree({ nodes, selectedId, selectedIds, onSelect, onToggle, depth = 0 }: { nodes: EngineNode[]; selectedId: string; selectedIds: ReadonlySet<string>; onSelect: (id: string) => void; onToggle: (id: string, checked: boolean) => void; depth?: number }) {
  return <div role={depth ? "group" : "tree"} aria-label={depth ? undefined : "Page layers"}>{nodes.map((node) => <div key={node.id} role="treeitem" aria-selected={node.id === selectedId} aria-expanded={node.type === "frame" ? true : undefined}><div className="flex items-center"><input type="checkbox" checked={selectedIds.has(node.id)} onChange={(event) => onToggle(node.id, event.target.checked)} aria-label={`Include ${node.name} in group selection`} className="ml-1" /><button type="button" onClick={() => onSelect(node.id)} style={{ paddingLeft: 5 + depth * 12 }} className={`flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[11px] ${node.id === selectedId ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#566057] hover:bg-white"}`}><span className="w-10 shrink-0 font-mono text-[8px] uppercase opacity-65">{node.type}</span><span className="truncate">{node.name}</span></button></div>{node.type === "frame" ? <LayerTree nodes={node.children} selectedId={selectedId} selectedIds={selectedIds} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} /> : null}</div>)}</div>;
}

function cloneForClipboard(node: EngineNode): EngineNode {
  const idMap = new Map<string, string>();
  const collect = (current: EngineNode) => { idMap.set(current.id, `paste-${crypto.randomUUID()}`); if (current.type === "frame") current.children.forEach(collect); };
  collect(node);
  const remap = (current: EngineNode): EngineNode => {
    const next = structuredClone(current);
    next.id = idMap.get(current.id)!;
    if (next.type === "frame") next.children = next.children.map(remap);
    if (next.type === "path") {
      if (next.startNodeId) next.startNodeId = idMap.get(next.startNodeId) ?? next.startNodeId;
      if (next.endNodeId) next.endNodeId = idMap.get(next.endNodeId) ?? next.endNodeId;
    }
    return next;
  };
  return remap(node);
}

function collectEditableNodeIds(node: EngineNode, rootId: string, ids: string[] = [], inheritedLocked = false): string[] {
  const locked = inheritedLocked || node.locked === true;
  if (node.id !== rootId && !locked) ids.push(node.id);
  if (node.type === "frame") node.children.forEach((child) => collectEditableNodeIds(child, rootId, ids, locked));
  return ids;
}

export function EngineV3Canvas({ initialDocument, initialProjectId = null, initialUpdatedAt = null, onDocumentChange }: EngineV3CanvasProps) {
  const router = useRouter();
  const historyRef = useRef<EngineV3HistoryController | null>(null);
  if (!historyRef.current) historyRef.current = new EngineV3HistoryController(initialDocument);
  const [document, setDocument] = useState(initialDocument);
  const [historyState, setHistoryState] = useState(() => historyRef.current!.snapshot());
  const [projectId, setProjectId] = useState(initialProjectId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [activePageId, setActivePageId] = useState(initialDocument.pages[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState(initialDocument.pages[0]?.root.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set(initialDocument.pages[0]?.root.id ? [initialDocument.pages[0].root.id] : []));
  const [drawer, setDrawer] = useState<"pages" | "layers" | "inspector" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});
  const [editorError, setEditorError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSafeMode, setAiSafeMode] = useState(true);
  const [aiProposal, setAiProposal] = useState<{ envelope: { command: EngineV3Command }; preview: EngineDocumentV3; affectedIds: string[]; explanation: string } | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle");
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [assetState, setAssetState] = useState<"loading" | "ready" | "uploading" | "unavailable" | "error">("loading");
  const [assetError, setAssetError] = useState<string | null>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const collaborationActorRef = useRef(`engine-v3-${crypto.randomUUID()}`);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLElement>(null);
  const [gestureGuides, setGestureGuides] = useState<SnapGuide[]>([]);
  const [collaborationConflicts, setCollaborationConflicts] = useState<ReconciliationConflict[]>([]);
  const [selectedBounds, setSelectedBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [selectedGroupBounds, setSelectedGroupBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const clipboardNodeRef = useRef<EngineNode | null>(null);
  const [clipboardAvailable, setClipboardAvailable] = useState(false);
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [zoom, setZoom] = useState(1);
  const [penMode, setPenMode] = useState(false);
  const spacePressedRef = useRef(false);
  const penPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const selectedNode = useMemo(() => activePage ? findEngineV3Node(document, activePage.id, selectedNodeId)?.node ?? activePage.root : null, [activePage, document, selectedNodeId]);
  const tokenEntries = useMemo(() => Object.entries(document.tokens.colors), [document.tokens.colors]);
  const activePageView = useMemo(() => activePage ? createEngineV3PageView(document, activePage.id) : null, [activePage, document]);
  const selectedLocation = useMemo(() => activePage && selectedNode ? findEngineV3Node(document, activePage.id, selectedNode.id) : null, [activePage, document, selectedNode]);
  const selectNode = (id: string, additive = false) => {
    if (!additive) {
      setSelectedNodeId(id);
      setSelectedNodeIds(new Set([id]));
      return;
    }
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add(id);
      return next;
    });
    setSelectedNodeId(id);
  };
  const beginTextEdit = (id: string) => {
    const location = activePage ? findEngineV3Node(document, activePage.id, id) : null;
    if (!location || location.node.type !== "text" || location.node.locked) return;
    selectNode(id);
    setEditingTextId(id);
    setEditingTextValue(location.node.content);
  };
  const finishTextEdit = () => {
    if (!editingTextId || !activePage) return;
    const location = findEngineV3Node(document, activePage.id, editingTextId);
    if (location?.node.type === "text" && editingTextValue !== location.node.content) patchSelected({ content: editingTextValue } as Partial<EngineNode>);
    setEditingTextId(null);
  };
  useEffect(() => {
    const measure = () => { const element = canvasRef.current?.querySelector<HTMLElement>(`[data-node-id="${selectedNodeId}"]`); const canvas = canvasRef.current; if (!element || !canvas) return setSelectedBounds(null); const a = element.getBoundingClientRect(); const b = canvas.getBoundingClientRect(); setSelectedBounds({ left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height }); };
    measure();
    const observer = new ResizeObserver(measure);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [selectedNodeId, selectedNodeIds, document, activePageId]);
  useEffect(() => {
    const measure = () => {
      const canvas = canvasRef.current;
      if (!canvas || selectedNodeIds.size < 2) { setSelectedGroupBounds(null); return; }
      const canvasBounds = canvas.getBoundingClientRect();
      const rects = [...selectedNodeIds].map((id) => canvas.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.getBoundingClientRect()).filter((rect): rect is DOMRect => Boolean(rect));
      if (!rects.length) { setSelectedGroupBounds(null); return; }
      const left = Math.min(...rects.map((rect) => rect.left)) - canvasBounds.left;
      const top = Math.min(...rects.map((rect) => rect.top)) - canvasBounds.top;
      const right = Math.max(...rects.map((rect) => rect.right)) - canvasBounds.left;
      const bottom = Math.max(...rects.map((rect) => rect.bottom)) - canvasBounds.top;
      setSelectedGroupBounds({ left, top, width: right - left, height: bottom - top });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [selectedNodeIds, document, activePageId]);

  const acceptHistory = (next: ReturnType<EngineV3HistoryController["snapshot"]>) => {
    setHistoryState(next);
    setDocument(next.document);
    onDocumentChange?.(next.document);
  };
  const collaboration = useEngineV3Collaboration(projectId, collaborationActorRef.current, (records, pending) => {
    let state = historyRef.current!.snapshot();
    const conflicts: ReconciliationConflict[] = [];
    for (const record of records) {
      if (record.envelope.actor === collaborationActorRef.current) continue;
      const reconciled = reconcileRemoteCommand(state.document, state.revision, record.envelope, pending);
      if (reconciled.kind === "conflict") conflicts.push(reconciled);
      else state = historyRef.current!.replaceFromRemote(reconciled.result.document, reconciled.result.revision);
    }
    if (conflicts.length) setCollaborationConflicts((current) => [...current, ...conflicts].slice(-20));
    acceptHistory(state);
  });
  const runCommand = (command: EngineV3Command, origin: "local" | "ai" = "local") => {
    try {
      const before = historyRef.current!.snapshot();
      const id = crypto.randomUUID();
      acceptHistory(historyRef.current!.apply(command, origin, collaborationActorRef.current, id));
      collaboration.publish({ id, baseRevision: before.revision, actor: collaborationActorRef.current, origin, timestamp: new Date().toISOString(), command });
      setEditorError(null);
      return true;
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The change could not be applied");
      return false;
    }
  };
  const requestAiProposal = async () => {
    if (!aiPrompt.trim() || !activePage) return;
    setAiState("loading"); setEditorError(null);
    try {
      const response = await fetch("/api/ai/engine-v3", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt.trim(), document, revision: historyState.revision, selectedNodeIds: [...selectedNodeIds], safeMode: aiSafeMode }) });
      const payload = await response.json() as { proposal?: NonNullable<typeof aiProposal>; error?: string; diagnostics?: Array<{ reason?: string }> };
      if (!response.ok || !payload.proposal) throw new Error(payload.error ?? payload.diagnostics?.map((item) => item.reason).filter(Boolean).join("; ") ?? "The AI proposal could not be created");
      setAiProposal(payload.proposal); setDocument(payload.proposal.preview); setAiState("idle");
    } catch (error) { setAiState("error"); setEditorError(error instanceof Error ? error.message : "The AI proposal could not be created"); }
  };
  const applyAiProposal = () => { if (!aiProposal) return; if (runCommand(aiProposal.envelope.command, "ai")) { setAiProposal(null); setAiPrompt(""); } };
  const rejectAiProposal = () => { setAiProposal(null); setDocument(historyRef.current!.snapshot().document); };
  const undo = () => acceptHistory(historyRef.current!.undo());
  const redo = () => acceptHistory(historyRef.current!.redo());
  const loadAssets = async () => {
    try {
      const response = await fetch("/api/engine-v3/assets");
      const payload = await response.json() as { assets?: StoredAsset[]; error?: string };
      if (!response.ok) { setAssetState(response.status === 503 ? "unavailable" : "error"); setAssetError(payload.error ?? "Assets could not be loaded"); return; }
      setAssets(payload.assets ?? []); setAssetState("ready"); setAssetError(null);
    } catch { setAssetState("error"); setAssetError("Assets could not be loaded"); }
  };
  useEffect(() => { void loadAssets(); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable=true]")) return;
      if (event.key === " " && !target?.closest("button, a, select")) { event.preventDefault(); spacePressedRef.current = true; return; }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "Enter" && selectedNode?.type === "text" && selectedNode.id !== activePage?.root.id && !target?.closest("button, a, select")) { event.preventDefault(); beginTextEdit(selectedNode.id); return; }
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (!modifier && !event.altKey && event.key === "Tab" && activePage && selectedNode && selectedNodeIds.size === 1) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "BODY" || target?.closest("[data-node-id]")) {
          const parent = selectedLocation?.parentId ? findEngineV3Node(document, activePage.id, selectedLocation.parentId)?.node : activePage.root;
          if (parent?.type === "frame" && parent.children.length > 1) {
            event.preventDefault();
            const index = selectedLocation?.index ?? 0;
            const nextIndex = (index + (event.shiftKey ? -1 : 1) + parent.children.length) % parent.children.length;
            selectNode(parent.children[nextIndex].id);
            return;
          }
        }
      }
      if (!modifier && !event.altKey && (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "0")) {
        event.preventDefault();
        if (event.key === "+" || event.key === "=") setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10));
        else if (event.key === "-") setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10));
        else setZoom(1);
        return;
      }
      if (!modifier && !event.altKey && activePage && !aiProposal) {
        const shortcutKind = key === "t" ? "text" : key === "r" ? "card" : key === "f" ? "frame" : null;
        if (shortcutKind) { event.preventDefault(); addCanvasNode(shortcutKind); return; }
        if (key === "p") { event.preventDefault(); setPenMode(true); return; }
        if (key === "v") { event.preventDefault(); setPenMode(false); return; }
      }
      if (modifier && key === "a" && activePage && selectedNode) {
        event.preventDefault();
        const ids = collectEditableNodeIds(activePage.root, activePage.root.id);
        if (ids.length) { setSelectedNodeIds(new Set(ids)); setSelectedNodeId(ids[0]); }
        return;
      }
      if (modifier && key === "d" && activePage && selectedNodeIds.size) {
        event.preventDefault();
        const nodeIds = [...selectedNodeIds].filter((nodeId) => nodeId !== activePage.root.id);
        if (nodeIds.length) runCommand({ kind: "batch", commands: nodeIds.map((nodeId) => ({ kind: "node" as const, action: "duplicate" as const, pageId: activePage.id, nodeId, precondition: { exists: true } })) });
        return;
      }
      if (modifier && key === "c" && selectedNodeIds.size === 1) { event.preventDefault(); copySelected(); return; }
      if (modifier && key === "v" && selectedNodeIds.size === 1) { event.preventDefault(); pasteSelected(); return; }
      if (event.key === "Escape" && activePage) {
        event.preventDefault();
        selectNode(selectedLocation?.parentId ?? activePage.root.id);
        return;
      }
      if (!modifier && activePage && selectedNodeIds.size === 1 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const nodeId = [...selectedNodeIds][0];
        if (nodeId === activePage.root.id) {
          event.preventDefault();
          const step = event.shiftKey ? 80 : 20;
          const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          canvasViewportRef.current?.scrollBy({ left: dx, top: dy, behavior: "smooth" });
          return;
        }
        if (nodeId !== activePage.root.id) {
          event.preventDefault();
          const location = findEngineV3Node(document, activePage.id, nodeId);
          if (location && !location.node.locked) {
            const step = event.shiftKey ? 10 : 1;
            const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
            const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
            runCommand({ kind: "batch", commands: [{ kind: "node", action: "patch", pageId: activePage.id, nodeId, changes: { transform: { ...(location.node.transform ?? {}), x: (location.node.transform?.x ?? 0) + dx, y: (location.node.transform?.y ?? 0) + dy } } }, ...connectorPatchesForMove(activePage.id, nodeId, dx, dy)] });
          }
          return;
        }
      }
      if (modifier && !event.altKey && activePage && selectedNodeIds.size === 1 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const nodeId = [...selectedNodeIds][0];
        const location = findEngineV3Node(document, activePage.id, nodeId);
        if (location && nodeId !== activePage.root.id && !location.node.locked) {
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          const width = typeof location.node.style?.width === "number" ? location.node.style.width : 240;
          const height = typeof location.node.style?.minHeight === "number" ? location.node.style.minHeight : 120;
          const changes = event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? { style: { ...location.node.style, width: Math.max(24, width + (event.key === "ArrowRight" ? step : -step)) } }
            : { style: { ...location.node.style, minHeight: Math.max(24, height + (event.key === "ArrowDown" ? step : -step)) } };
          runCommand({ kind: "node", action: "patch", pageId: activePage.id, nodeId, changes });
          return;
        }
      }
      if (!modifier && (event.key === "Delete" || event.key === "Backspace") && activePage) {
        const removable = [...selectedNodeIds].filter((id) => id !== activePage.root.id);
        if (removable.length) {
          event.preventDefault();
          runCommand({ kind: "batch", commands: removable.map((nodeId) => ({ kind: "node", action: "remove", pageId: activePage.id, nodeId, precondition: { exists: true } })) });
          selectNode(activePage.root.id);
        }
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === " ") spacePressedRef.current = false; };
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  });
  const patchSelected = (changes: Partial<EngineNode>) => {
    if (!activePage || !selectedNode) return;
    runCommand({ kind: "node", action: "patch", pageId: activePage.id, nodeId: selectedNode.id, changes: changes as Record<string, unknown> });
  };
  const visualNodeTransform = (nodeId: string) => {
    if (!activePage || !canvasRef.current) return null;
    const element = canvasRef.current.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!element) return null;
    const canvasBounds = canvasRef.current.getBoundingClientRect();
    const scale = canvasBounds.width ? activePage.width / canvasBounds.width : 1;
    const parentElement = element.parentElement?.closest<HTMLElement>("[data-node-id]");
    const parentBounds = parentElement?.getBoundingClientRect() ?? canvasBounds;
    const parentId = parentElement?.dataset.nodeId;
    const parentTransform = parentId ? findEngineV3Node(document, activePage.id, parentId)?.node.transform : undefined;
    return {
      x: (parentTransform?.x ?? 0) + (element.getBoundingClientRect().left - parentBounds.left) * scale,
      y: (parentTransform?.y ?? 0) + (element.getBoundingClientRect().top - parentBounds.top) * scale,
      scale,
    };
  };
  const connectorPatchesForMove = (pageId: string, movedNodeId: string, dx: number, dy: number): EngineV3Command[] => {
    const page = document.pages.find((candidate) => candidate.id === pageId); if (!page) return [];
    const paths: EngineNode[] = [];
    const visit = (node: EngineNode) => { if (node.type === "path") paths.push(node); if (node.type === "frame") node.children.forEach(visit); };
    visit(page.root);
    return paths.filter((node): node is Extract<EngineNode, { type: "path" }> => node.type === "path" && (node.startNodeId === movedNodeId || node.endNodeId === movedNodeId)).map((path) => {
      const movedPoints = path.points.map((point, index) => (path.startNodeId === movedNodeId && index === 0) || (path.endNodeId === movedNodeId && index === path.points.length - 1) ? { x: point.x + dx, y: point.y + dy } : point);
      const minX = Math.min(...movedPoints.map((point) => point.x)); const minY = Math.min(...movedPoints.map((point) => point.y));
      const points = movedPoints.map((point) => ({ x: point.x - minX, y: point.y - minY }));
      return { kind: "node", action: "patch", pageId, nodeId: path.id, changes: { points, transform: { ...(path.transform ?? {}), x: (path.transform?.x ?? 0) + minX, y: (path.transform?.y ?? 0) + minY } } };
    });
  };
  const connectorPatchesForMoves = (source: EngineDocumentV3, pageId: string, moves: ReadonlyMap<string, { dx: number; dy: number }>): EngineV3Command[] => {
    const page = source.pages.find((candidate) => candidate.id === pageId); if (!page) return [];
    const paths: Extract<EngineNode, { type: "path" }>[] = [];
    const visit = (node: EngineNode) => { if (node.type === "path") paths.push(node); if (node.type === "frame") node.children.forEach(visit); };
    visit(page.root);
    return paths.flatMap((path) => {
      const ownMove = moves.get(path.id);
      if (ownMove) return [{ kind: "node", action: "patch", pageId, nodeId: path.id, changes: { transform: { ...(path.transform ?? {}), x: (path.transform?.x ?? 0) + ownMove.dx, y: (path.transform?.y ?? 0) + ownMove.dy } } } satisfies EngineV3Command];
      if (!moves.has(path.startNodeId ?? "") && !moves.has(path.endNodeId ?? "")) return [];
      const movedPoints = path.points.map((point, index) => {
        const move = index === 0 ? moves.get(path.startNodeId ?? "") : index === path.points.length - 1 ? moves.get(path.endNodeId ?? "") : undefined;
        return move ? { x: point.x + move.dx, y: point.y + move.dy } : point;
      });
      const minX = Math.min(...movedPoints.map((point) => point.x)); const minY = Math.min(...movedPoints.map((point) => point.y));
      return [{ kind: "node", action: "patch", pageId, nodeId: path.id, changes: { points: movedPoints.map((point) => ({ x: point.x - minX, y: point.y - minY })), transform: { ...(path.transform ?? {}), x: (path.transform?.x ?? 0) + minX, y: (path.transform?.y ?? 0) + minY } } } satisfies EngineV3Command];
    });
  };
  const beginNodeDrag = (nodeId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !activePage) return;
    if (penMode) {
      beginPen(event as unknown as React.PointerEvent<HTMLDivElement>);
      return;
    }
    const location = findEngineV3Node(document, activePage.id, nodeId);
    if (!location || location.node.locked) return;
    const dragIds = selectedNodeIds.has(nodeId)
      ? [...selectedNodeIds].filter((id) => id !== activePage.root.id && !findEngineV3Node(document, activePage.id, id)?.node.locked)
      : [nodeId];
    if (dragIds.length > 1) {
      const startX = event.clientX;
      const startY = event.clientY;
      const pageId = activePage.id;
      const baseDocument = historyRef.current!.snapshot().document;
      const sessions = dragIds.map((id) => {
        const item = findEngineV3Node(baseDocument, pageId, id);
        if (!item) return null;
        const parent = engineV3NodeParentOffset(baseDocument, pageId, id);
        const localX = item.node.transform?.x ?? 0;
        const localY = item.node.transform?.y ?? 0;
        return { id, node: item.node, parent, globalX: localX + parent.x, globalY: localY + parent.y };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
      let moved = false;
      let previewDocument = baseDocument;
      const move = (pointer: PointerEvent) => {
        const scale = visualNodeTransform(nodeId)?.scale ?? 1;
        const dx = (pointer.clientX - startX) * scale;
        const dy = (pointer.clientY - startY) * scale;
        if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) < 3) return;
        moved = true;
        try {
          previewDocument = sessions.reduce((current, session) => patchEngineV3Node(current, pageId, session.id, { transform: { ...(session.node.transform ?? {}), x: Math.round(session.globalX + dx - session.parent.x), y: Math.round(session.globalY + dy - session.parent.y) } }), baseDocument);
          setDocument(previewDocument);
        } catch { /* The committed command reports the actionable error. */ }
      };
      const finish = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
        if (moved) {
          const moves = new Map<string, { dx: number; dy: number }>();
          const commands: EngineV3Command[] = sessions.map((session) => {
            const next = findEngineV3Node(previewDocument, pageId, session.id)?.node;
            moves.set(session.id, { dx: (next?.transform?.x ?? session.node.transform?.x ?? 0) - (session.node.transform?.x ?? 0), dy: (next?.transform?.y ?? session.node.transform?.y ?? 0) - (session.node.transform?.y ?? 0) });
            return { kind: "node", action: "patch", pageId, nodeId: session.id, changes: { transform: { ...(session.node.transform ?? {}), ...(next?.transform ?? {}) } } };
          });
          runCommand({ kind: "batch", commands: [...commands, ...connectorPatchesForMoves(baseDocument, pageId, moves)] });
          window.setTimeout(() => setSelectedNodeIds(new Set(dragIds)), 0);
        } else setDocument(historyRef.current!.snapshot().document);
      };
      const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDocument(historyRef.current!.snapshot().document); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
      return;
    }
    selectNode(nodeId, event.shiftKey || event.metaKey || event.ctrlKey);
    const startX = event.clientX; const startY = event.clientY;
    const visual = visualNodeTransform(nodeId);
    const originalX = visual?.x ?? location.node.transform?.x ?? 0; const originalY = visual?.y ?? location.node.transform?.y ?? 0;
    const originalLocalX = location.node.transform?.x ?? 0; const originalLocalY = location.node.transform?.y ?? 0;
    const pageId = activePage.id; const baseDocument = historyRef.current!.snapshot().document;
    let finalX = originalLocalX; let finalY = originalLocalY; let finalGlobalX = originalX; let finalGlobalY = originalY; let moved = false;
    const move = (pointer: PointerEvent) => {
      const scale = visual?.scale ?? 1;
      const desiredGlobalX = originalX + (pointer.clientX - startX) * scale; const desiredGlobalY = originalY + (pointer.clientY - startY) * scale;
      if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) < 3) return;
      moved = true;
      try { const preview = dragEngineV3Node(baseDocument, pageId, nodeId, desiredGlobalX, desiredGlobalY); const previewNode = findEngineV3Node(preview.document, pageId, nodeId)?.node; finalX = previewNode?.transform?.x ?? finalX; finalY = previewNode?.transform?.y ?? finalY; const parent = engineV3NodeParentOffset(preview.document, pageId, nodeId); finalGlobalX = finalX + parent.x; finalGlobalY = finalY + parent.y; setDocument(preview.document); setGestureGuides(preview.guides); } catch { /* The committed command reports the actionable error. */ }
    };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      setGestureGuides([]);
      if (moved) {
        const dx = finalGlobalX - originalX; const dy = finalGlobalY - originalY;
        runCommand({ kind: "batch", commands: [{ kind: "node", action: "patch", pageId, nodeId, changes: { transform: { ...(location.node.transform ?? {}), x: finalX, y: finalY } } }, ...connectorPatchesForMove(pageId, nodeId, dx, dy)] });
        window.setTimeout(() => selectNode(nodeId), 0);
      }
      else setDocument(historyRef.current!.snapshot().document);
    };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setGestureGuides([]); setDocument(historyRef.current!.snapshot().document); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const beginNodeResize = (event: React.PointerEvent<HTMLButtonElement>, handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" = "se") => {
    if (!activePage || !selectedNode || selectedNode.locked || !selectedBounds) return;
    event.preventDefault(); event.stopPropagation();
    const visual = visualNodeTransform(selectedNode.id);
    const scale = visual?.scale ?? 1;
    const startWidth = selectedBounds.width; const startHeight = selectedBounds.height;
    const startX = visual?.x ?? selectedNode.transform?.x ?? 0; const startY = visual?.y ?? selectedNode.transform?.y ?? 0;
    const pageId = activePage.id; const nodeId = selectedNode.id; const base = historyRef.current!.snapshot().document; const parentOffset = engineV3NodeParentOffset(base, pageId, nodeId); let width = startWidth; let height = startHeight; let x = startX; let y = startY; let changed = false;
    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - event.clientX; const dy = pointer.clientY - event.clientY;
      if (handle.includes("e")) width = Math.max(24, startWidth + dx);
      if (handle.includes("w")) { width = Math.max(24, startWidth - dx); x = startX + startWidth - width; }
      if (handle.includes("s")) height = Math.max(24, startHeight + dy);
      if (handle.includes("n")) { height = Math.max(24, startHeight - dy); y = startY + startHeight - height; }
      changed = true;
      const changes: Partial<EngineNode> = { style: { ...selectedNode.style, width: Math.round(width), minHeight: Math.round(height) } };
      if (handle.includes("w") || handle.includes("n")) changes.transform = { ...selectedNode.transform, x: Math.round(x - parentOffset.x), y: Math.round(y - parentOffset.y) };
      try { setDocument(patchEngineV3Node(base, pageId, nodeId, changes)); } catch { /* commit below reports failures */ }
    };
    const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); if (changed) { const changes: Record<string, unknown> = { style: { ...selectedNode.style, width: Math.round(width), minHeight: Math.round(height) } }; if (handle.includes("w") || handle.includes("n")) changes.transform = { ...selectedNode.transform, x: Math.round(x - parentOffset.x), y: Math.round(y - parentOffset.y) }; runCommand({ kind: "node", action: "patch", pageId, nodeId, changes }); } };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDocument(historyRef.current!.snapshot().document); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const beginGroupResize = (event: React.PointerEvent<HTMLButtonElement>, handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w") => {
    if (!activePage || !selectedGroupBounds || selectedNodeIds.size < 2 || !canvasRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const canvasBounds = canvasRef.current.getBoundingClientRect();
    const scale = activePage.width / Math.max(canvasBounds.width, 1);
    const startLeft = selectedGroupBounds.left * scale;
    const startTop = selectedGroupBounds.top * scale;
    const startWidth = selectedGroupBounds.width;
    const startHeight = selectedGroupBounds.height;
    const base = historyRef.current!.snapshot().document;
    const pageId = activePage.id;
    const sessions = [...selectedNodeIds].map((id) => {
      const location = findEngineV3Node(base, pageId, id);
      const element = canvasRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
      if (!location || !element || id === activePage.root.id || location.node.locked) return null;
      const rect = element.getBoundingClientRect();
      const globalX = (rect.left - canvasBounds.left) * scale;
      const globalY = (rect.top - canvasBounds.top) * scale;
      return { id, node: location.node, parent: engineV3NodeParentOffset(base, pageId, id), globalX, globalY, width: rect.width, height: rect.height };
    }).filter((session): session is NonNullable<typeof session> => Boolean(session));
    if (sessions.length < 2) return;
    let nextLeft = startLeft; let nextTop = startTop; let nextWidth = startWidth; let nextHeight = startHeight; let changed = false;
    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - event.clientX;
      const dy = pointer.clientY - event.clientY;
      nextWidth = startWidth; nextHeight = startHeight; nextLeft = startLeft; nextTop = startTop;
      if (handle.includes("e")) nextWidth = Math.max(48, startWidth + dx);
      if (handle.includes("w")) { nextWidth = Math.max(48, startWidth - dx); nextLeft = startLeft + startWidth - nextWidth; }
      if (handle.includes("s")) nextHeight = Math.max(48, startHeight + dy);
      if (handle.includes("n")) { nextHeight = Math.max(48, startHeight - dy); nextTop = startTop + startHeight - nextHeight; }
      changed = true;
      const sx = nextWidth / Math.max(startWidth, 1); const sy = nextHeight / Math.max(startHeight, 1);
      let preview = base;
      try {
        for (const session of sessions) {
          const width = Math.max(24, Math.round(session.width * sx));
          const height = Math.max(24, Math.round(session.height * sy));
          const globalX = nextLeft + (session.globalX - startLeft) * sx;
          const globalY = nextTop + (session.globalY - startTop) * sy;
          preview = patchEngineV3Node(preview, pageId, session.id, {
            transform: { ...(session.node.transform ?? {}), x: Math.round(globalX - session.parent.x), y: Math.round(globalY - session.parent.y) },
            style: { ...session.node.style, width, minHeight: height },
          });
        }
        setDocument(preview);
      } catch { /* The committed command reports the actionable error. */ }
    };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      if (!changed) return;
      const sx = nextWidth / Math.max(startWidth, 1); const sy = nextHeight / Math.max(startHeight, 1);
      const commands: EngineV3Command[] = sessions.map((session) => ({
        kind: "node", action: "patch", pageId, nodeId: session.id,
        changes: {
          transform: { ...(session.node.transform ?? {}), x: Math.round(nextLeft + (session.globalX - startLeft) * sx - session.parent.x), y: Math.round(nextTop + (session.globalY - startTop) * sy - session.parent.y) },
          style: { ...session.node.style, width: Math.max(24, Math.round(session.width * sx)), minHeight: Math.max(24, Math.round(session.height * sy)) },
        },
      }));
      runCommand({ kind: "batch", commands });
      window.setTimeout(() => setSelectedNodeIds(new Set(sessions.map((session) => session.id))), 0);
    };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDocument(historyRef.current!.snapshot().document); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const beginNodeRotate = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!activePage || !selectedNode || selectedNode.locked || !selectedBounds) return;
    event.preventDefault(); event.stopPropagation();
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return;
    const centerX = canvasBounds.left + selectedBounds.left + selectedBounds.width / 2;
    const centerY = canvasBounds.top + selectedBounds.top + selectedBounds.height / 2;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const startRotation = selectedNode.transform?.rotation ?? 0;
    const pageId = activePage.id; const nodeId = selectedNode.id; const base = historyRef.current!.snapshot().document; let rotation = startRotation; let changed = false;
    const move = (pointer: PointerEvent) => {
      rotation = Math.round(startRotation + (Math.atan2(pointer.clientY - centerY, pointer.clientX - centerX) - startAngle) * 180 / Math.PI);
      changed = true;
      try { setDocument(patchEngineV3Node(base, pageId, nodeId, { transform: { ...selectedNode.transform, rotation } })); } catch { /* commit below reports failures */ }
    };
    const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); if (changed) runCommand({ kind: "node", action: "patch", pageId, nodeId, changes: { transform: { ...selectedNode.transform, rotation } } }); };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDocument(historyRef.current!.snapshot().document); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const beginPathPointDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (!activePage || !selectedNode || selectedNode.type !== "path" || selectedNode.locked || !selectedBounds || !canvasRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const base = historyRef.current!.snapshot().document; const pageId = activePage.id; const nodeId = selectedNode.id; let finalPoints = selectedNode.points;
    const maxX = Math.max(...selectedNode.points.map((point) => point.x), 1); const maxY = Math.max(...selectedNode.points.map((point) => point.y), 1);
    const move = (pointer: PointerEvent) => {
      const x = Math.max(0, Math.min(maxX, Math.round((pointer.clientX - (canvasRef.current!.getBoundingClientRect().left + selectedBounds.left)) / selectedBounds.width * maxX)));
      const y = Math.max(0, Math.min(maxY, Math.round((pointer.clientY - (canvasRef.current!.getBoundingClientRect().top + selectedBounds.top)) / selectedBounds.height * maxY)));
      finalPoints = selectedNode.points.map((point, pointIndex) => pointIndex === index ? { x, y } : point);
      try { setDocument(patchEngineV3Node(base, pageId, nodeId, { points: finalPoints } as Partial<EngineNode>)); } catch { /* Commit below reports failures. */ }
    };
    const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); runCommand({ kind: "node", action: "patch", pageId, nodeId, changes: { points: finalPoints } }); };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDocument(historyRef.current!.snapshot().document); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const placeAsset = (asset: StoredAsset) => {
    if (!activePage) return;
    const nodeId = `image-${crypto.randomUUID()}`;
    const assetRef = { sha256: asset.sha256, mime: asset.mime, source: asset.source, ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), ...(asset.license ? { license: asset.license } : {}) };
    const commands: EngineV3Command[] = [];
    if (!document.assets[asset.sha256]) commands.push({ kind: "asset", action: "define", asset: assetRef, precondition: { exists: false } });
    commands.push({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node: { id: nodeId, name: "Image", type: "image", assetRef: asset.sha256, alt: "Uploaded image", style: { width: Math.min(asset.width ?? 420, 720) } } });
    if (runCommand({ kind: "batch", commands })) selectNode(nodeId);
  };
  const addCanvasNode = (kind: "text" | "card" | "frame" | "circle" | "line" | "arrow" | "triangle" | "diamond" | "star") => {
    if (!activePage) return;
    const id = `${kind}-${crypto.randomUUID()}`;
    const offset = 72 + activePage.root.children.length * 12;
    const shapePoints = kind === "triangle" ? [{ x: 110, y: 0 }, { x: 220, y: 190 }, { x: 0, y: 190 }] : kind === "diamond" ? [{ x: 110, y: 0 }, { x: 220, y: 110 }, { x: 110, y: 220 }, { x: 0, y: 110 }] : [{ x: 110, y: 0 }, { x: 136, y: 76 }, { x: 210, y: 76 }, { x: 150, y: 122 }, { x: 174, y: 198 }, { x: 110, y: 152 }, { x: 46, y: 198 }, { x: 70, y: 122 }, { x: 10, y: 76 }, { x: 84, y: 76 }];
    const node: EngineNode = ["triangle", "diamond", "star"].includes(kind)
      ? { id, name: kind[0].toUpperCase() + kind.slice(1), type: "path", points: shapePoints, closed: true, lineStyle: "straight", transform: { x: offset, y: offset }, style: { width: kind === "star" ? 220 : 220, minHeight: kind === "triangle" ? 190 : 220, background: "$lime", borderColor: "$ink", color: "$ink", borderWidth: 2 } }
      : kind === "text"
      ? { id, name: "Text", type: "text", content: "Double-click to edit", variant: "heading", transform: { x: offset, y: offset }, style: { width: 280, color: "$ink" } }
      : kind === "arrow"
        ? { id, name: "Arrow", type: "path", points: [{ x: 0, y: 0 }, { x: 120, y: 0 }], lineStyle: "straight", arrowEnd: true, transform: { x: offset, y: offset }, style: { width: 120, minHeight: 24, color: "$cobalt", borderWidth: 3 } }
        : { id, name: kind === "card" ? "Card" : kind === "circle" ? "Circle" : kind === "line" ? "Line" : "Frame", type: "frame", transform: { x: offset, y: offset }, layout: { mode: "flex", direction: "column", gap: 12, padding: kind === "card" ? 20 : 0 }, style: { width: kind === "line" ? 280 : kind === "circle" ? 220 : kind === "card" ? 280 : 360, minHeight: kind === "line" ? 4 : kind === "circle" ? 220 : kind === "card" ? 180 : 240, background: kind === "card" ? "$panel" : "transparent", borderColor: kind === "card" ? "$rule" : "$cobalt", borderWidth: kind === "line" ? 3 : kind === "card" ? 1 : 2, borderRadius: kind === "circle" ? 999 : kind === "card" ? 16 : 8 }, children: [] };
    if (runCommand({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node })) selectNode(id);
  };
  const uploadAsset = async (file: File) => {
    setAssetState("uploading"); setAssetError(null);
    const form = new FormData(); form.set("file", file); form.set("source", file.name);
    try {
      const response = await fetch("/api/engine-v3/assets", { method: "POST", body: form });
      const payload = await response.json() as { asset?: StoredAsset; error?: string };
      if (!response.ok || !payload.asset) { setAssetState(response.status === 503 ? "unavailable" : "error"); setAssetError(payload.error ?? "Upload failed"); return; }
      setAssets((current) => [payload.asset!, ...current.filter((asset) => asset.sha256 !== payload.asset!.sha256)]);
      setAssetState("ready"); placeAsset(payload.asset);
    } catch { setAssetState("error"); setAssetError("Upload failed"); }
  };
  const deleteStoredAsset = async (asset: StoredAsset) => {
    if (document.assets[asset.sha256]) return;
    const response = await fetch(`/api/engine-v3/assets?sha256=${asset.sha256}`, { method: "DELETE" });
    if (response.ok) setAssets((current) => current.filter((item) => item.sha256 !== asset.sha256));
    else setAssetError("Asset could not be deleted");
  };
  const addPage = () => {
    const id = "page-" + crypto.randomUUID();
    const page: Page = { id, name: pageName(document.pages, "Untitled page"), width: 1080, height: 720, background: "#F7F8F4", root: { id: id + "-root", name: "Page", type: "frame", layout: { mode: "flex", direction: "column", gap: 0, padding: 32 }, children: [] } };
    if (!runCommand({ kind: "page", action: "add", page, index: document.pages.length })) return;
    setActivePageId(id);
    selectNode(page.root.id);
  };
  const duplicatePage = () => {
    if (!activePage) return;
    const id = "page-" + crypto.randomUUID();
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const next = duplicateV3Page(document, activePage.id, id, index + 1);
    const pageIndex = next.pages.findIndex((page) => page.id === id);
    next.pages[pageIndex] = { ...next.pages[pageIndex], name: pageName(document.pages, activePage.name + " copy") };
    if (!runCommand({ kind: "page", action: "add", page: next.pages[pageIndex], index: pageIndex })) return;
    setActivePageId(id);
    selectNode(next.pages[pageIndex].root.id);
  };
  const deletePage = () => {
    if (!activePage || document.pages.length <= 1) return;
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const result = removeV3Page(document, activePage.id, activePage.id);
    if (!runCommand({ kind: "page", action: "remove", page: { id: activePage.id } })) return;
    setActivePageId(result.activePageId || result.document.pages[Math.max(0, index - 1)]?.id);
    selectNode(result.document.pages.find((page) => page.id === result.activePageId)?.root.id ?? result.document.pages[0].root.id);
  };
  const renamePage = (name: string) => {
    if (activePage && name.trim()) runCommand({ kind: "page", action: "rename", page: { id: activePage.id, name: name.trim() } });
  };
  const updateColorToken = (key: string, value: string) => {
    const colors = { ...document.tokens.colors, [key]: { ...document.tokens.colors[key], value } };
    runCommand({ kind: "tokens", tokens: { ...document.tokens, colors } });
  };
  const commitColorToken = (key: string) => {
    const value = colorDrafts[key];
    if (value === undefined) return;
    if (value.trim() && !/[<>`]/.test(value)) updateColorToken(key, value.trim());
    setColorDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  };
  const commitColorValue = (key: string, value: string) => {
    updateColorToken(key, value);
    setColorDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  };
  const resolvedStyleColor = (value: unknown, fallback: string) => {
    if (typeof value !== "string") return fallback;
    if (!value.startsWith("$")) return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    const token = document.tokens.colors[value.slice(1)];
    return typeof token?.value === "string" && /^#[0-9a-f]{6}$/i.test(token.value) ? token.value : fallback;
  };
  const patchSelectedStyle = (changes: Record<string, unknown>) => {
    if (!activePage || !selectedNode) return;
    const targets = [...selectedNodeIds].map((id) => findEngineV3Node(document, activePage.id, id)?.node).filter((node): node is EngineNode => Boolean(node && node.id !== activePage.root.id));
    if (targets.length > 1) {
      runCommand({ kind: "batch", commands: targets.map((node) => ({ kind: "node" as const, action: "patch" as const, pageId: activePage.id, nodeId: node.id, changes: { style: { ...node.style, ...changes } } })) });
    } else patchSelected({ style: { ...selectedNode.style, ...changes } });
  };
  const beginPen = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!penMode || event.button !== 0 || !activePage || !canvasRef.current) return;
    event.preventDefault();
    const bounds = canvasRef.current.getBoundingClientRect();
    const point = (clientX: number, clientY: number) => ({ x: Math.max(0, Math.round((clientX - bounds.left) * activePage.width / bounds.width)), y: Math.max(0, Math.round((clientY - bounds.top) * (activePage.height === "auto" ? 720 : activePage.height) / bounds.height)) });
    penPointsRef.current = [point(event.clientX, event.clientY)];
    const move = (pointer: PointerEvent) => { const next = point(pointer.clientX, pointer.clientY); const previous = penPointsRef.current.at(-1); if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) >= 3) penPointsRef.current.push(next); };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      const points = penPointsRef.current; penPointsRef.current = [];
      if (points.length < 2) return;
      const minX = Math.min(...points.map((item) => item.x)); const minY = Math.min(...points.map((item) => item.y));
      const nodeId = `path-${crypto.randomUUID()}`;
      const node: EngineNode = { id: nodeId, name: "Pen path", type: "path", transform: { x: minX, y: minY }, points: points.map((item) => ({ x: item.x - minX, y: item.y - minY })), style: { width: Math.max(...points.map((item) => item.x)) - minX || 1, minHeight: Math.max(...points.map((item) => item.y)) - minY || 1, color: "$ink", borderWidth: 3 } } as EngineNode;
      if (runCommand({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node })) selectNode(nodeId);
    };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); penPointsRef.current = []; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
  };
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (penMode) { beginPen(event); return; }
    if (event.button === 0 && activePage) {
      const target = event.target as Element | null;
      if (!target?.closest("[data-node-id]") && canvasRef.current) {
        event.preventDefault();
        selectNode(activePage.root.id);
        if (spacePressedRef.current && canvasViewportRef.current) {
          const viewport = canvasViewportRef.current;
          const start = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
          const move = (pointer: PointerEvent) => { viewport.scrollLeft = start.left - (pointer.clientX - start.x); viewport.scrollTop = start.top - (pointer.clientY - start.y); };
          const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); };
          window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
          return;
        }
        const bounds = canvasRef.current.getBoundingClientRect();
        const start = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        let current = start;
        const update = (pointer: PointerEvent) => {
          current = { x: pointer.clientX - bounds.left, y: pointer.clientY - bounds.top };
          setMarquee({ left: Math.min(start.x, current.x), top: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) });
        };
        const finish = () => {
          window.removeEventListener("pointermove", update); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
          setMarquee(null);
          if (Math.abs(current.x - start.x) < 6 && Math.abs(current.y - start.y) < 6) { selectNode(activePage.root.id); return; }
          const left = Math.min(start.x, current.x); const right = Math.max(start.x, current.x); const top = Math.min(start.y, current.y); const bottom = Math.max(start.y, current.y);
          const ids = [...canvasRef.current!.querySelectorAll<HTMLElement>("[data-node-id]")].filter((element) => element.dataset.nodeId !== activePage.root.id).filter((element) => { const rect = element.getBoundingClientRect(); const x = rect.left - bounds.left; const y = rect.top - bounds.top; return x < right && x + rect.width > left && y < bottom && y + rect.height > top; }).map((element) => element.dataset.nodeId).filter((id): id is string => Boolean(id));
          if (ids.length) { setSelectedNodeId(ids[0]); setSelectedNodeIds(new Set(ids)); } else selectNode(activePage.root.id);
        };
        const cancel = () => { window.removeEventListener("pointermove", update); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setMarquee(null); };
        window.addEventListener("pointermove", update); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
      }
    }
  };
  const makeComponent = () => {
    if (!selectedNode || selectedNode.componentRef || !activePage) return;
    let id = `${selectedNode.id}-component`;
    let suffix = 2;
    while (document.components[id]) id = `${selectedNode.id}-component-${suffix++}`;
    try {
      const defined = defineComponent(document.components, id, selectedNode.name, selectedNode);
      runCommand({ kind: "batch", commands: [
        { kind: "component", action: "define", component: defined.components[id] },
        { kind: "node", action: "patch", pageId: activePage.id, nodeId: selectedNode.id, changes: { componentRef: id, instanceOverrides: {} } },
      ] });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The component could not be created");
    }
  };
  const detachComponent = () => patchSelected({ componentRef: undefined, instanceOverrides: undefined });
  const duplicateSelected = () => {
    if (!activePage) return;
    const nodeIds = [...selectedNodeIds].filter((nodeId) => nodeId !== activePage.root.id);
    if (nodeIds.length) runCommand({ kind: "batch", commands: nodeIds.map((nodeId) => ({ kind: "node" as const, action: "duplicate" as const, pageId: activePage.id, nodeId, precondition: { exists: true } })) });
  };
  const copySelected = () => { if (selectedNode && selectedNode.id !== activePage?.root.id) { clipboardNodeRef.current = cloneForClipboard(selectedNode); setClipboardAvailable(true); } };
  const pasteSelected = () => {
    if (!activePage || !selectedLocation || !clipboardNodeRef.current) return;
    const node = cloneForClipboard(clipboardNodeRef.current);
    if (runCommand({ kind: "node", action: "add", pageId: activePage.id, parentId: selectedLocation.parentId, index: selectedLocation.index + 1, node })) selectNode(node.id);
  };
  const removeSelected = () => { if (activePage && selectedNode && selectedNode.id !== activePage.root.id) runCommand({ kind: "node", action: "remove", pageId: activePage.id, nodeId: selectedNode.id, precondition: { exists: true } }); };
  const ungroupSelected = () => { if (activePage && selectedNode?.type === "frame" && selectedNode.id !== activePage.root.id) runCommand({ kind: "node", action: "ungroup", pageId: activePage.id, nodeId: selectedNode.id }); };
  const reorderSelected = (offset: -1 | 1) => { if (activePage && selectedLocation && selectedLocation.parentId !== null) runCommand({ kind: "node", action: "reorder", pageId: activePage.id, nodeId: selectedLocation.node.id, toIndex: selectedLocation.index + offset }); };
  const groupSelected = () => {
    if (!activePage || selectedNodeIds.size < 2) return;
    const id = `group-${crypto.randomUUID()}`;
    if (runCommand({ kind: "node", action: "group", pageId: activePage.id, nodeIds: [...selectedNodeIds], frame: { id, name: "Group", type: "frame", layout: { mode: "flex", gap: 0, padding: 0 }, children: [] } })) selectNode(id);
  };
  const alignSelected = (mode: "left" | "center" | "right" | "distribute") => {
    if (!activePage || selectedNodeIds.size < 2) return;
    const locations = [...selectedNodeIds].map((id) => findEngineV3Node(document, activePage.id, id)).filter((location): location is NonNullable<typeof location> => Boolean(location));
    if (locations.length < 2 || locations.some((location) => location.parentId !== locations[0].parentId)) return;
    const widthOf = (location: (typeof locations)[number]) => typeof location.node.style?.width === "number" ? location.node.style.width : 0;
    const ordered = [...locations].sort((a, b) => (a.node.transform?.x ?? 0) - (b.node.transform?.x ?? 0));
    const commands = mode === "distribute"
      ? ordered.slice(1, -1).map((location, index) => ({ kind: "node" as const, action: "patch" as const, pageId: activePage.id, nodeId: location.node.id, changes: { transform: { ...location.node.transform, x: (ordered[0].node.transform?.x ?? 0) + (index + 1) * (((ordered.at(-1)!.node.transform?.x ?? 0) + widthOf(ordered.at(-1)!)) - (ordered[0].node.transform?.x ?? 0) - widthOf(ordered[0])) / (ordered.length - 1) - widthOf(location) } } }))
      : locations.map((location) => {
        const x = mode === "left" ? Math.min(...locations.map((item) => item.node.transform?.x ?? 0)) : mode === "right" ? Math.max(...locations.map((item) => (item.node.transform?.x ?? 0) + widthOf(item))) - widthOf(location) : (Math.min(...locations.map((item) => item.node.transform?.x ?? 0)) + Math.max(...locations.map((item) => (item.node.transform?.x ?? 0) + widthOf(item)))) / 2 - widthOf(location) / 2;
        return { kind: "node" as const, action: "patch" as const, pageId: activePage.id, nodeId: location.node.id, changes: { transform: { ...location.node.transform, x: Math.round(x) } } };
      });
    if (commands.length) runCommand({ kind: "batch", commands });
  };
  const connectSelected = () => {
    if (!activePage || selectedNodeIds.size !== 2) return;
    const selected = [...selectedNodeIds].map((id) => findEngineV3Node(document, activePage.id, id)?.node).filter((node): node is EngineNode => Boolean(node && node.id !== activePage.root.id && node.type !== "path"));
    if (selected.length !== 2) return;
    const center = (node: EngineNode) => ({ x: (node.transform?.x ?? 0) + (typeof node.style?.width === "number" ? node.style.width : 120) / 2, y: (node.transform?.y ?? 0) + (node.style?.minHeight ?? 60) / 2 });
    const start = center(selected[0]); const end = center(selected[1]); const id = `connector-${crypto.randomUUID()}`;
    const minX = Math.min(start.x, end.x); const minY = Math.min(start.y, end.y);
    const node: EngineNode = { id, name: "Connector", type: "path", points: [{ x: start.x - minX, y: start.y - minY }, { x: end.x - minX, y: end.y - minY }], lineStyle: "straight", arrowEnd: true, startNodeId: selected[0].id, endNodeId: selected[1].id, transform: { x: minX, y: minY }, style: { width: Math.max(Math.abs(end.x - start.x), 1), minHeight: Math.max(Math.abs(end.y - start.y), 24), color: "$cobalt", borderWidth: 3 } } as EngineNode;
    if (runCommand({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node })) selectNode(id);
  };
  const saveDocument = async () => {
    setSaveState("saving");
    try {
      const source = serializeEngineV3Document(document);
      if (projectId) {
        if (!updatedAt) throw new Error("Missing project version");
        const result = await saveEngineV2Project(projectId, document.metadata.name, source, updatedAt, "Engine v3 save");
        if (!result.ok) { setSaveState("conflict"); return null; }
        setUpdatedAt(result.updatedAt);
      } else {
        const created = await createEngineV2Project(document.metadata.name, source);
        setProjectId(created.id);
        setUpdatedAt(created.updatedAt);
        router.replace(`/app/engine-v2?id=${created.id}&mode=v3`);
      }
      setSaveState("saved");
      return projectId;
    } catch {
      setSaveState("error");
      return null;
    }
  };
  const shareDocument = async () => {
    setShareState("sharing");
    try {
      let id = projectId;
      if (id) {
        if (!updatedAt) throw new Error("Missing project version");
        const result = await saveEngineV2Project(id, document.metadata.name, serializeEngineV3Document(document), updatedAt, "Shared v3 version");
        if (!result.ok) { setSaveState("conflict"); setShareState("error"); return; }
        setUpdatedAt(result.updatedAt);
      } else {
        const created = await createEngineV2Project(document.metadata.name, serializeEngineV3Document(document));
        id = created.id;
        setProjectId(id);
        setUpdatedAt(created.updatedAt);
      }
      const url = `${window.location.origin}/s/${await createShareLink(id)}`;
      setShareUrl(url);
      try {
        if (!navigator.clipboard) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(url);
        setShareState("copied");
      } catch {
        setShareState("idle");
      }
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch {
      setShareState("error");
    }
  };
  const copyShareUrl = async () => {
    if (!shareUrl || !navigator.clipboard) return;
    try { await navigator.clipboard.writeText(shareUrl); setShareState("copied"); window.setTimeout(() => setShareState("idle"), 1600); } catch { setShareState("error"); }
  };
  const download = (payload: Pick<EngineV3ExportPayload, "filename" | "mimeType"> & { contents: string | Blob }) => {
    const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const rasterizeSvg = async (svg: EngineV3ExportPayload) => {
    const source = new Blob([svg.contents], { type: "image/svg+xml" });
    const url = URL.createObjectURL(source);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      const canvas = window.document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is unavailable in this browser");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG export could not be created");
      return { blob, width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const downloadPng = async (svg: EngineV3ExportPayload) => {
    const raster = await rasterizeSvg(svg);
    download({ ...svg, filename: svg.filename.replace(/\.svg$/i, ".png"), mimeType: "image/png", contents: raster.blob });
  };
  const downloadPdf = async (svg: EngineV3ExportPayload) => {
    const raster = await rasterizeSvg(svg);
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("PDF image conversion failed")); reader.onerror = () => reject(new Error("PDF image conversion failed")); reader.readAsDataURL(raster.blob); });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: raster.width >= raster.height ? "landscape" : "portrait", unit: "px", format: [raster.width, raster.height] });
    pdf.addImage(dataUrl, "PNG", 0, 0, raster.width, raster.height);
    download({ filename: svg.filename.replace(/\.svg$/i, ".pdf"), mimeType: "application/pdf", contents: pdf.output("blob") });
  };
  const exportActivePage = async (kind: "svg" | "html" | "tsx" | "png" | "pdf") => {
    try {
      const portable = await inlineEngineV3Assets(document, async (sha256) => {
        const response = await fetch(`/api/engine-v3/assets?sha256=${sha256}`);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => resolve(null); reader.readAsDataURL(blob);
        });
      });
      const payload = createEngineV3PageExports(portable, kind === "png" || kind === "pdf" ? "svg" : kind).find((item) => item.pageId === activePageId);
      if (payload) {
        if (kind === "png") await downloadPng(payload);
        else if (kind === "pdf") await downloadPdf(payload);
        else download(payload);
      }
      setEditorError(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The export could not be created");
    }
  };

  if (!activePage || !activePageView) return <main className="flex min-h-[420px] items-center justify-center bg-[#F7F8F4] text-sm text-[#667067]">Create a page to begin.</main>;
  return (
    <main className="flex min-h-[680px] flex-col overflow-hidden bg-[#F7F8F4] text-[#15171A]">
      <header className="flex min-h-14 items-center justify-between border-b border-[#D7DBD2] bg-[#F7F8F4] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><button type="button" className="rounded-md p-2 hover:bg-[#E4E7E1] lg:hidden" aria-label="Open layers" onClick={() => setDrawer("layers")}><Layers3 size={16} /></button><div className="truncate text-sm font-semibold">{document.metadata.name}</div><span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#667067] sm:inline">Engine v3</span>{projectId ? <button type="button" onClick={() => collaboration.status === "offline" ? void collaboration.retry() : undefined} className="rounded px-2 py-1 font-mono text-[9px] uppercase text-[#667067]" aria-label={`Collaboration ${collaboration.status}`}>{collaboration.status === "synced" ? "Live" : collaboration.status === "offline" ? "Offline" : "Syncing"}</button> : null}</div>
        <div className="flex items-center gap-1"><button type="button" onClick={undo} disabled={!historyState.canUndo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Undo" title="Undo"><Undo2 size={15} /></button><button type="button" onClick={redo} disabled={!historyState.canRedo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Redo" title="Redo"><Redo2 size={15} /></button><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md p-2 hover:bg-[#E4E7E1] xl:hidden" aria-label="Open inspector"><PanelRight size={15} /></button><button type="button" onClick={saveDocument} disabled={saveState === "saving" || saveState === "conflict"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Save document" title={saveState === "conflict" ? "Reload required" : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Save"}><Save size={15} /></button><button type="button" onClick={shareDocument} disabled={shareState === "sharing"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Share document" title={shareState === "copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}><Share2 size={15} /></button><button type="button" onClick={() => void exportActivePage("svg")} className="rounded-md p-2 hover:bg-[#E4E7E1]" aria-label="Export active page as SVG" title="Export active page as SVG"><Download size={15} /></button><button type="button" onClick={() => void exportActivePage("png")} className="rounded-md px-2 py-2 font-mono text-[9px] font-semibold uppercase hover:bg-[#E4E7E1]" aria-label="Export active page as PNG">PNG</button>{(["html", "tsx"] as const).map((kind) => <button key={kind} type="button" onClick={() => void exportActivePage(kind)} className="hidden rounded-md px-2 py-2 font-mono text-[9px] font-semibold uppercase hover:bg-[#E4E7E1] sm:block" aria-label={`Export active page as ${kind.toUpperCase()}`}>{kind}</button>)}<button type="button" onClick={() => download(createEngineV3JsonExport(document))} className="rounded-md px-2 py-2 font-mono text-[9px] font-semibold hover:bg-[#E4E7E1]" aria-label="Export document JSON">JSON</button></div>
      </header>
      <div className="flex justify-end border-b border-[#D7DBD2] bg-[#F7F8F4] px-3 py-1 sm:px-5"><button type="button" onClick={() => void exportActivePage("pdf")} className="rounded-md px-2 py-1 font-mono text-[9px] font-semibold uppercase hover:bg-[#E4E7E1]" aria-label="Export active page as PDF">PDF</button></div>
      {shareUrl ? <div className="flex flex-wrap items-center gap-2 border-b border-[#D7DBD2] bg-[#EEF0EA] px-3 py-2 sm:px-5" role="status" aria-label="Share link ready"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#566057]">Share link</span><input readOnly value={shareUrl} aria-label="Share link URL" className="min-w-0 flex-1 rounded border border-[#C8CEC4] bg-white px-2 py-1 text-xs text-[#566057]" /><button type="button" onClick={() => void copyShareUrl()} className="rounded border border-[#C8CEC4] bg-white px-2 py-1 text-xs font-semibold hover:border-[#3157F6]" aria-label="Copy share link">{shareState === "copied" ? "Copied" : "Copy"}</button></div> : null}
      {collaborationConflicts.length ? <div role="alert" className="flex items-center justify-between border-b border-[#D98A76] bg-[#FFF0EB] px-4 py-2 text-xs text-[#8B2D13]"><span>Concurrent edits touched the same item. Review the current result before saving.</span><button type="button" className="rounded border border-[#D98A76] bg-white px-2 py-1 font-semibold" onClick={() => setCollaborationConflicts([])}>Dismiss</button></div> : null}
      <section className="border-b border-[#D7DBD2] bg-[#15171A] px-4 py-3 text-white" aria-label="AI proposal editor"><form className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void requestAiProposal(); }}><input aria-label="AI edit prompt" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder={selectedNodeIds.size ? "Describe an edit to the selected nodes" : "Describe what to create"} disabled={Boolean(aiProposal)} className="min-w-[220px] flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/50 focus:border-[#B7FF4A] disabled:opacity-50" /><label className="flex items-center gap-2 px-1 text-xs"><input aria-label="AI safe mode" type="checkbox" checked={aiSafeMode} onChange={(event) => setAiSafeMode(event.target.checked)} disabled={Boolean(aiProposal)} /> Safe mode</label><button type="submit" disabled={!aiPrompt.trim() || aiState === "loading" || Boolean(aiProposal)} className="rounded-md bg-[#B7FF4A] px-3 py-2 text-xs font-semibold text-[#15171A] disabled:opacity-40">{aiState === "loading" ? "Thinking…" : "Propose"}</button></form>{aiProposal ? <div className="mx-auto mt-3 flex max-w-[1080px] flex-wrap items-center justify-between gap-3 rounded-md border border-[#B7FF4A]/40 bg-white/10 px-3 py-2 text-xs" role="status" aria-label="AI change proposal"><span><strong>Preview:</strong> {aiProposal.explanation || "Review proposed changes"} ({aiProposal.affectedIds.length} affected)</span><span className="flex gap-2"><button type="button" onClick={applyAiProposal} className="rounded bg-[#B7FF4A] px-3 py-1.5 font-semibold text-[#15171A]">Apply</button><button type="button" onClick={rejectAiProposal} className="rounded border border-white/30 px-3 py-1.5">Reject</button></span></div> : null}</section>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-[#D7DBD2] bg-white px-2 py-3" aria-label="Create tools">
          <button type="button" className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#15171A] text-white" aria-label="Select tool" title="Select"><MousePointer2 size={17} /></button>
          <button type="button" onClick={() => activePage && selectNode(activePage.root.id)} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Deselect" title="Deselect"><X size={15} /><span>Deselect</span></button>
          <button type="button" onClick={() => setPenMode((value) => !value)} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${penMode ? "bg-[#B7FF4A] text-[#15171A]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Draw with pen" aria-pressed={penMode}><Pen size={17} /><span>Pen</span></button>
          <button type="button" onClick={() => addCanvasNode("text")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add text"><Type size={17} /><span>Text</span></button>
          <button type="button" onClick={() => addCanvasNode("card")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add card"><Square size={17} /><span>Card</span></button>
          <button type="button" onClick={() => addCanvasNode("frame")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add frame"><Frame size={17} /><span>Frame</span></button>
          <button type="button" onClick={() => addCanvasNode("circle")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add circle"><Circle size={17} /><span>Circle</span></button>
          <label className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" title="Add vector shape"><select aria-label="Add shape" defaultValue="" onChange={(event) => { if (event.target.value) addCanvasNode(event.target.value as "triangle" | "diamond" | "star"); event.currentTarget.value = ""; }} className="h-6 w-8 cursor-pointer rounded border border-[#C8CEC4] bg-white text-[9px]"><option value="">◇</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="star">Star</option></select><span>Shape</span></label>
          <button type="button" onClick={() => addCanvasNode("line")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add line"><Minus size={17} /><span>Line</span></button>
          <button type="button" onClick={() => addCanvasNode("arrow")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add arrow"><ArrowUpRight size={17} /><span>Arrow</span></button>
          <button type="button" onClick={() => assetInputRef.current?.click()} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add image"><ImageIcon size={17} /><span>Image</span></button>
          <div className="my-2 h-px w-8 bg-[#D7DBD2]" />
          <button type="button" onClick={connectSelected} disabled={selectedNodeIds.size !== 2} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA] disabled:opacity-35" aria-label="Connect selected objects" title="Connect selected objects"><ArrowUpRight size={16} /><span>Connect</span></button>
          <button type="button" onClick={() => setDrawer(drawer === "pages" ? null : "pages")} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${drawer === "pages" ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Show pages"><Copy size={16} /><span>Pages</span></button>
          <button type="button" onClick={() => setDrawer(drawer === "layers" ? null : "layers")} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${drawer === "layers" ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Show layers"><Layers3 size={16} /><span>Layers</span></button>
        </aside>
        {drawer === "pages" || drawer === "layers" ? <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-[#D7DBD2] bg-[#F5F6F2] p-3 max-lg:fixed max-lg:inset-y-14 max-lg:left-[68px] max-lg:z-30 max-lg:shadow-xl" aria-label={drawer === "pages" ? "Pages" : "Layers"}>
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">{drawer === "pages" ? "Pages" : "Layers"}</span><button type="button" aria-label={`Close ${drawer}`} className="rounded p-1 hover:bg-[#DDE1D9]" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          {drawer === "pages" ? <><div className="space-y-2" role="tablist" aria-label="Document pages">{document.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id} onClick={() => { setActivePageId(page.id); selectNode(page.root.id); }} className={`w-full rounded-lg border p-2 text-left ${page.id === activePage.id ? "border-[#3157F6] bg-white shadow-sm" : "border-[#D7DBD2] bg-[#F7F8F4] hover:border-[#3157F6]"}`}><div className="mb-2 flex aspect-[4/3] items-center justify-center rounded border border-[#D7DBD2] bg-white text-[10px] text-[#667067]">{page.name.slice(0, 1).toUpperCase()}</div><span className="block truncate text-xs font-medium">{page.name}</span></button>)}</div><div className="mt-3 grid grid-cols-3 gap-1"><button type="button" onClick={addPage} className="rounded-md border border-[#C8CEC4] bg-white p-2" aria-label="Add page"><Plus size={13} /></button><button type="button" onClick={duplicatePage} className="rounded-md border border-[#C8CEC4] bg-white p-2" aria-label="Duplicate page"><Copy size={13} /></button><button type="button" onClick={deletePage} disabled={document.pages.length <= 1} className="rounded-md border border-[#C8CEC4] bg-white p-2 text-[#B93815] disabled:opacity-35" aria-label="Delete page"><Trash2 size={13} /></button></div></> : <LayerTree nodes={[activePage.root]} selectedId={selectedNode?.id ?? ""} selectedIds={selectedNodeIds} onSelect={selectNode} onToggle={(id, checked) => setSelectedNodeIds((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; })} />}
        </aside> : null}
        <section ref={canvasViewportRef} className="relative min-w-0 flex-1 overflow-auto bg-[#E9EBE6] p-4 sm:p-8" aria-label="Editable canvas">
          <div className="sticky top-0 z-40 mx-auto mb-3 flex w-fit items-center gap-1 rounded-full border border-[#D7DBD2] bg-white/95 p-1 shadow-sm backdrop-blur" aria-label="Canvas zoom">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))} className="rounded-full p-1.5 text-[#566057] hover:bg-[#EEF0EA]" aria-label="Zoom out" title="Zoom out"><Minus size={13} /></button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-12 rounded-full px-2 py-1 font-mono text-[10px] font-semibold text-[#566057] hover:bg-[#EEF0EA]" aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))} className="rounded-full p-1.5 text-[#566057] hover:bg-[#EEF0EA]" aria-label="Zoom in" title="Zoom in"><Plus size={13} /></button>
          </div>
          <div className="mx-auto max-sm:min-w-[720px]" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 1080 : "none" }}><div ref={canvasRef} onPointerDown={handleCanvasPointerDown} className={`relative w-full overflow-hidden rounded-xl border border-[#D7DBD2] bg-white shadow-sm ${penMode ? "cursor-crosshair" : ""}`} style={{ aspectRatio: activePage.height === "auto" ? undefined : `${activePage.width} / ${activePage.height}` }}>
          <EngineDocumentView document={activePageView} selectedIds={selectedNodeIds} onSelect={selectNode} onPointerDown={beginNodeDrag} onDoubleClick={beginTextEdit} onEditText={beginTextEdit} />
          {selectedGroupBounds ? <div data-selection-group aria-label="Group selection bounds" className="pointer-events-none absolute z-20 border border-dashed border-[#3157F6]" style={{ left: selectedGroupBounds.left - 6, top: selectedGroupBounds.top - 6, width: selectedGroupBounds.width + 12, height: selectedGroupBounds.height + 12 }} /> : null}
          {selectedBounds && selectedNode && selectedNode.id !== activePage.root.id ? <div aria-hidden="true" className="pointer-events-none absolute z-20 border-2 border-[#3157F6]" style={{ left: selectedBounds.left, top: selectedBounds.top, width: selectedBounds.width, height: selectedBounds.height }} /> : null}
          {(selectedGroupBounds || (selectedBounds && selectedNode && selectedNode.id !== activePage.root.id)) ? (() => {
            const bounds = selectedGroupBounds ?? selectedBounds!;
            const stop = (event: React.PointerEvent) => { event.preventDefault(); event.stopPropagation(); };
            const swatches = [["ink", document.tokens.colors.ink?.value], ["cobalt", document.tokens.colors.cobalt?.value], ["orange", document.tokens.colors.orange?.value], ["lime", document.tokens.colors.lime?.value]].filter((entry): entry is [string, string] => typeof entry[1] === "string");
            return <div role="toolbar" aria-label="Quick object actions" className="pointer-events-none absolute z-50 flex max-w-[calc(100%-8px)] flex-wrap items-center gap-1 rounded-lg border border-[#C8CEC4] bg-white/95 p-1 shadow-lg backdrop-blur" style={{ left: Math.max(4, Math.min(bounds.left, activePage.width - 360)), top: Math.max(4, bounds.top - 44) }}>
              <button type="button" onPointerDown={stop} onClick={duplicateSelected} className="pointer-events-auto rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#566057] hover:bg-[#EEF0EA]" aria-label="Quick duplicate selected">Duplicate</button>
              <label className="pointer-events-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[#566057] hover:bg-[#EEF0EA]" title="Fill color"><input onPointerDown={stop} aria-label="Quick fill color" type="color" value={resolvedStyleColor(selectedNode?.style?.background, "#ffffff")} onChange={(event) => patchSelectedStyle({ background: event.target.value })} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" />Fill</label>
              {swatches.map(([name, value]) => <button key={name} type="button" onPointerDown={stop} aria-label={`Quick fill ${name}`} title={`Fill ${name}`} onClick={() => patchSelectedStyle({ background: value })} className="pointer-events-auto h-5 w-5 rounded-full border border-[#C8CEC4] shadow-inner" style={{ background: value }} />)}
              <label className="pointer-events-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[#566057] hover:bg-[#EEF0EA]" title="Border color"><input onPointerDown={stop} aria-label="Quick border color" type="color" value={resolvedStyleColor(selectedNode?.style?.borderColor, "#d7dbd2")} onChange={(event) => patchSelectedStyle({ borderColor: event.target.value, borderWidth: selectedNode?.style?.borderWidth ?? 1 })} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" />Border</label>
              {[1, 2, 4].map((width) => <button key={width} type="button" onPointerDown={stop} aria-label={`Quick stroke width ${width}`} title={`Stroke ${width}px`} onClick={() => patchSelectedStyle({ borderWidth: width })} className={`pointer-events-auto rounded-md px-1.5 py-1 text-[10px] text-[#566057] hover:bg-[#EEF0EA] ${selectedNode?.style?.borderWidth === width ? "bg-[#DCE3FF] text-[#2448D8]" : ""}`}>{width}px</button>)}
              {selectedGroupBounds ? <select aria-label="Quick alignment" defaultValue="" onChange={(event) => { if (event.target.value) alignSelected(event.target.value as "left" | "center" | "right" | "distribute"); event.currentTarget.value = ""; }} onPointerDown={stop} className="pointer-events-auto rounded-md border border-[#C8CEC4] bg-white px-1.5 py-1 text-[10px] text-[#566057]"><option value="">Arrange</option><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option><option value="distribute">Space evenly</option></select> : null}
              {selectedNode?.type === "text" ? <button type="button" onPointerDown={stop} onClick={() => patchSelectedStyle({ fontWeight: selectedNode.style?.fontWeight === 700 ? undefined : 700 })} className={`pointer-events-auto rounded-md px-2 py-1.5 text-[10px] font-semibold hover:bg-[#EEF0EA] ${selectedNode.style?.fontWeight === 700 ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#566057]"}`} aria-label="Quick toggle bold" aria-pressed={selectedNode.style?.fontWeight === 700}>Bold</button> : null}
              <button type="button" onPointerDown={stop} onClick={removeSelected} className="pointer-events-auto rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#B93815] hover:bg-[#FFF0EB]" aria-label="Quick delete selected">Delete</button>
            </div>;
          })() : null}
          {marquee ? <div aria-label="Marquee selection" className="pointer-events-none absolute z-40 border border-[#3157F6] bg-[#3157F6]/10" style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }} /> : null}
          {selectedBounds && selectedNode && selectedNode.id !== activePage.root.id ? <button type="button" aria-label="Rotate selected node" onPointerDown={beginNodeRotate} className="absolute z-30 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#FF5D2E] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5D2E]" style={{ left: selectedBounds.left + selectedBounds.width / 2, top: selectedBounds.top - 28, cursor: "grab" }} /> : null}
          {selectedBounds && selectedNode && selectedNode.id !== activePage.root.id ? ([
            ["nw", selectedBounds.left - 6, selectedBounds.top - 6, "nwse-resize"],
            ["n", selectedBounds.left + selectedBounds.width / 2 - 10, selectedBounds.top - 5, "ns-resize"],
            ["ne", selectedBounds.left + selectedBounds.width - 6, selectedBounds.top - 6, "nesw-resize"],
            ["e", selectedBounds.left + selectedBounds.width - 5, selectedBounds.top + selectedBounds.height / 2 - 10, "ew-resize"],
            ["se", selectedBounds.left + selectedBounds.width - 6, selectedBounds.top + selectedBounds.height - 6, "nwse-resize"],
            ["s", selectedBounds.left + selectedBounds.width / 2 - 10, selectedBounds.top + selectedBounds.height - 5, "ns-resize"],
            ["sw", selectedBounds.left - 6, selectedBounds.top + selectedBounds.height - 6, "nesw-resize"],
            ["w", selectedBounds.left - 5, selectedBounds.top + selectedBounds.height / 2 - 10, "ew-resize"],
          ] as const).map(([handle, left, top, cursor]) => <button key={handle} type="button" aria-label={`Resize selected node ${handle}`} onPointerDown={(event) => beginNodeResize(event, handle)} className={`absolute z-30 border-2 border-white bg-[#3157F6] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157F6] ${handle.length === 1 ? handle === "n" || handle === "s" ? "h-3 w-5 rounded-full" : "h-5 w-3 rounded-full" : "h-3 w-3 rounded-sm"}`} style={{ left, top, cursor }} />) : null}
          {selectedGroupBounds ? ([
            ["nw", selectedGroupBounds.left - 6, selectedGroupBounds.top - 6, "nwse-resize"],
            ["n", selectedGroupBounds.left + selectedGroupBounds.width / 2 - 10, selectedGroupBounds.top - 5, "ns-resize"],
            ["ne", selectedGroupBounds.left + selectedGroupBounds.width - 6, selectedGroupBounds.top - 6, "nesw-resize"],
            ["e", selectedGroupBounds.left + selectedGroupBounds.width - 5, selectedGroupBounds.top + selectedGroupBounds.height / 2 - 10, "ew-resize"],
            ["se", selectedGroupBounds.left + selectedGroupBounds.width - 6, selectedGroupBounds.top + selectedGroupBounds.height - 6, "nwse-resize"],
            ["s", selectedGroupBounds.left + selectedGroupBounds.width / 2 - 10, selectedGroupBounds.top + selectedGroupBounds.height - 5, "ns-resize"],
            ["sw", selectedGroupBounds.left - 6, selectedGroupBounds.top + selectedGroupBounds.height - 6, "nesw-resize"],
            ["w", selectedGroupBounds.left - 5, selectedGroupBounds.top + selectedGroupBounds.height / 2 - 10, "ew-resize"],
          ] as const).map(([handle, left, top, cursor]) => <button key={`group-${handle}`} type="button" aria-label={`Resize selected group ${handle}`} onPointerDown={(event) => beginGroupResize(event, handle)} className={`absolute z-30 border-2 border-white bg-[#3157F6] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157F6] ${handle.length === 1 ? handle === "n" || handle === "s" ? "h-3 w-5 rounded-full" : "h-5 w-3 rounded-full" : "h-3 w-3 rounded-sm"}`} style={{ left, top, cursor }} />) : null}
          {editingTextId === selectedNode?.id && selectedBounds ? <textarea aria-label="Inline text editor" autoFocus value={editingTextValue} onChange={(event) => setEditingTextValue(event.target.value)} onBlur={finishTextEdit} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditingTextId(null); } if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); finishTextEdit(); } }} className="absolute z-40 resize-none overflow-hidden rounded border-2 border-[#3157F6] bg-white/95 p-2 text-inherit outline-none shadow-lg" style={{ left: selectedBounds.left, top: selectedBounds.top, width: Math.max(selectedBounds.width, 120), minHeight: Math.max(selectedBounds.height, 48) }} /> : null}
          {selectedBounds && selectedNode?.type === "path" ? selectedNode.points.map((point, index) => { const maxX = Math.max(...selectedNode.points.map((item) => item.x), 1); const maxY = Math.max(...selectedNode.points.map((item) => item.y), 1); return <button key={`point-${index}`} type="button" aria-label={`Edit pen point ${index + 1}`} onPointerDown={(event) => beginPathPointDrag(event, index)} className="absolute z-40 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#FF5D2E] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5D2E]" style={{ left: selectedBounds.left + point.x / maxX * selectedBounds.width, top: selectedBounds.top + point.y / maxY * selectedBounds.height, cursor: "move" }} />; }) : null}
          {gestureGuides.map((guide, index) => guide.axis === "x" ? <div key={`${guide.axis}-${guide.position}-${index}`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[#3157F6]" style={{ left: `${guide.position / activePage.width * 100}%` }} /> : activePage.height === "auto" ? null : <div key={`${guide.axis}-${guide.position}-${index}`} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 h-px bg-[#3157F6]" style={{ top: `${guide.position / activePage.height * 100}%` }} />)}
          </div></div>
        </section>
        <aside className={`w-[272px] shrink-0 overflow-y-auto border-l border-[#D7DBD2] bg-[#EEF0EA] p-4 max-xl:fixed max-xl:inset-y-14 max-xl:right-0 max-xl:z-30 max-xl:shadow-xl ${drawer === "inspector" ? "max-xl:block" : "max-xl:hidden"}`} aria-label="Inspector">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold">Design</div><div className="text-[10px] text-[#667067]">{selectedNode?.name ?? "Page"}</div></div><button type="button" aria-label="Close inspector" className="rounded p-1 hover:bg-[#DDE1D9] xl:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          {selectedNode && selectedNode.id !== activePage.root.id ? <section className="mb-4 rounded-xl border border-[#D7DBD2] bg-white p-3" aria-label="Object colors"><div className="mb-3 text-xs font-semibold">Colors</div><div className="grid grid-cols-3 gap-2"><label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected fill color" type="color" value={resolvedStyleColor(selectedNode.style?.background, "#ffffff")} onChange={(event) => patchSelectedStyle({ background: event.target.value })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Fill</label>{selectedNode.type === "text" ? <label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected text color" type="color" value={resolvedStyleColor(selectedNode.style?.color, "#15171a")} onChange={(event) => patchSelectedStyle({ color: event.target.value })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Text</label> : <div /> }<label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected border color" type="color" value={resolvedStyleColor(selectedNode.style?.borderColor, "#d7dbd2")} onChange={(event) => patchSelectedStyle({ borderColor: event.target.value, borderWidth: selectedNode.style?.borderWidth ?? 1 })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Border</label></div><div className="mt-3 space-y-2"><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Fill CSS</span><input aria-label="Selected fill CSS" value={typeof selectedNode.style?.background === "string" ? selectedNode.style.background : ""} onChange={(event) => patchSelectedStyle({ background: event.target.value })} placeholder="#ffffff or linear-gradient(...)" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-[10px] text-[#667067]">Stroke width</span><input aria-label="Selected stroke width" type="number" min="0" max="32" value={selectedNode.style?.borderWidth ?? 0} onChange={(event) => patchSelectedStyle({ borderWidth: Math.max(0, Math.min(32, Number(event.target.value) || 0)) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-[10px] text-[#667067]">Radius</span><input aria-label="Selected corner radius" type="number" min="0" max="999" value={selectedNode.style?.borderRadius ?? 0} onChange={(event) => patchSelectedStyle({ borderRadius: Math.max(0, Math.min(999, Number(event.target.value) || 0)) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Shadow</span><input aria-label="Selected shadow" value={selectedNode.style?.boxShadow ?? ""} onChange={(event) => patchSelectedStyle({ boxShadow: event.target.value })} placeholder="0 8px 24px rgba(0,0,0,.12)" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div></section> : null}
          {selectedNode?.type === "text" ? <section className="mb-4 rounded-xl border border-[#D7DBD2] bg-white p-3" aria-label="Text editing"><div className="mb-2 text-xs font-semibold">Text</div><textarea aria-label="Edit selected text" value={selectedNode.content} onChange={(event) => patchSelected({ content: event.target.value } as Partial<EngineNode>)} rows={4} className="mb-3 w-full resize-y rounded-lg border border-[#C8CEC4] px-2 py-2 text-sm outline-none focus:border-[#3157F6]" /><div className="grid grid-cols-3 gap-2"><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Style</span><select aria-label="Text style" value={selectedNode.variant} onChange={(event) => patchSelected({ variant: event.target.value as typeof selectedNode.variant })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs"><option value="display">Display</option><option value="heading">Heading</option><option value="body">Body</option><option value="caption">Caption</option><option value="eyebrow">Eyebrow</option></select></label><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Align</span><select aria-label="Text alignment" value={selectedNode.style?.textAlign ?? "left"} onChange={(event) => patchSelectedStyle({ textAlign: event.target.value as "left" | "center" | "right" })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Size</span><input aria-label="Text font size" type="number" min="8" max="160" value={selectedNode.style?.fontSize ?? ""} placeholder="Auto" onChange={(event) => patchSelectedStyle({ fontSize: event.target.value ? Math.max(8, Math.min(160, Number(event.target.value))) : undefined })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" aria-label="Toggle bold text" aria-pressed={selectedNode.style?.fontWeight === 700} onClick={() => patchSelectedStyle({ fontWeight: selectedNode.style?.fontWeight === 700 ? undefined : 700 })} className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${selectedNode.style?.fontWeight === 700 ? "border-[#3157F6] bg-[#DCE3FF] text-[#2448D8]" : "border-[#C8CEC4]"}`}>Bold</button><button type="button" aria-label="Toggle italic text" aria-pressed={selectedNode.style?.fontStyle === "italic"} onClick={() => patchSelectedStyle({ fontStyle: selectedNode.style?.fontStyle === "italic" ? undefined : "italic" })} className={`rounded-md border px-2 py-1.5 text-xs italic ${selectedNode.style?.fontStyle === "italic" ? "border-[#3157F6] bg-[#DCE3FF] text-[#2448D8]" : "border-[#C8CEC4]"}`}>Italic</button><button type="button" aria-label="Toggle underline text" aria-pressed={selectedNode.style?.textDecoration === "underline"} onClick={() => patchSelectedStyle({ textDecoration: selectedNode.style?.textDecoration === "underline" ? undefined : "underline" })} className={`rounded-md border px-2 py-1.5 text-xs underline ${selectedNode.style?.textDecoration === "underline" ? "border-[#3157F6] bg-[#DCE3FF] text-[#2448D8]" : "border-[#C8CEC4]"}`}>Underline</button></div></section> : null}
          {selectedNode?.type === "image" ? <section className="mb-4 rounded-xl border border-[#D7DBD2] bg-white p-3" aria-label="Image framing"><div className="mb-3 text-xs font-semibold">Image framing</div><label className="mb-2 block"><span className="mb-1 block text-[10px] text-[#667067]">Fit</span><select aria-label="Image fit" value={selectedNode.style?.objectFit ?? "contain"} onChange={(event) => patchSelectedStyle({ objectFit: event.target.value })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs"><option value="contain">Contain</option><option value="cover">Crop to fill</option><option value="fill">Stretch</option><option value="none">Original size</option></select></label><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Position</span><input aria-label="Image position" value={selectedNode.style?.objectPosition ?? "50% 50%"} onChange={(event) => patchSelectedStyle({ objectPosition: event.target.value })} placeholder="50% 50%" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></section> : null}
          {selectedNode?.type === "path" ? <section className="mb-4 rounded-xl border border-[#D7DBD2] bg-white p-3" aria-label="Connector settings"><div className="mb-3 text-xs font-semibold">Path</div><label className="mb-2 block"><span className="mb-1 block text-[10px] text-[#667067]">Line style</span><select aria-label="Connector line style" value={selectedNode.lineStyle ?? "straight"} onChange={(event) => patchSelected({ lineStyle: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs"><option value="straight">Straight</option><option value="elbow">Elbow</option><option value="curve">Curved</option></select></label><label className="mb-2 flex items-center gap-2 text-xs"><input aria-label="Closed path" type="checkbox" checked={selectedNode.closed === true} onChange={(event) => patchSelected({ closed: event.target.checked } as Partial<EngineNode>)} />Closed shape</label><label className="mb-2 flex items-center gap-2 text-xs"><input aria-label="Connector arrow end" type="checkbox" checked={selectedNode.arrowEnd === true} onChange={(event) => patchSelected({ arrowEnd: event.target.checked } as Partial<EngineNode>)} />Arrow at end</label><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-[10px] text-[#667067]">Start ID</span><input aria-label="Connector start node" value={selectedNode.startNodeId ?? ""} onChange={(event) => patchSelected({ startNodeId: event.target.value || undefined } as Partial<EngineNode>)} placeholder="optional" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-[10px] text-[#667067]">End ID</span><input aria-label="Connector end node" value={selectedNode.endNodeId ?? ""} onChange={(event) => patchSelected({ endNodeId: event.target.value || undefined } as Partial<EngineNode>)} placeholder="optional" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div><p className="mt-2 text-[10px] leading-4 text-[#667067]">Bound endpoints follow object movement.</p></section> : null}
          <details className="group"><summary className="mb-4 cursor-pointer list-none rounded-lg border border-[#C8CEC4] bg-white px-3 py-2 text-xs font-semibold">More settings</summary>
          {selectedNode && selectedNode.id !== activePage.root.id ? <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-[#D7DBD2] bg-white p-3"><label><span className="mb-1 block text-xs text-[#667067]">Width{selectedNodeIds.size > 1 ? " for selection" : ""}</span><input aria-label="V3 node width" type="number" min="24" value={typeof selectedNode.style?.width === "number" ? selectedNode.style.width : ""} placeholder="Auto" onChange={(event) => patchSelectedStyle({ width: event.target.value ? Math.max(24, Number(event.target.value)) : undefined })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Height{selectedNodeIds.size > 1 ? " for selection" : ""}</span><input aria-label="V3 node height" type="number" min="24" value={selectedNode.style?.minHeight ?? ""} placeholder="Auto" onChange={(event) => patchSelectedStyle({ minHeight: event.target.value ? Math.max(24, Number(event.target.value)) : undefined })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div> : null}
          {selectedNode ? <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Structure</legend><div className="grid grid-cols-4 gap-1"><button type="button" onClick={duplicateSelected} disabled={selectedNode.id === activePage.root.id} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Duplicate</button><button type="button" onClick={copySelected} disabled={selectedNode.id === activePage.root.id} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Copy</button><button type="button" onClick={pasteSelected} disabled={!clipboardAvailable || !selectedLocation} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Paste</button><button type="button" onClick={() => reorderSelected(-1)} disabled={!selectedLocation || selectedLocation.parentId === null || selectedLocation.index <= 0} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Move up</button><button type="button" onClick={() => reorderSelected(1)} disabled={!selectedLocation || selectedLocation.parentId === null} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Move down</button><button type="button" onClick={groupSelected} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Group</button><button type="button" onClick={ungroupSelected} disabled={selectedNode.type !== "frame" || selectedNode.id === activePage.root.id} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Ungroup</button><button type="button" onClick={removeSelected} disabled={selectedNode.id === activePage.root.id} className="rounded-md border border-[#D98A76] px-2 py-1.5 text-[10px] font-semibold text-[#B93815] disabled:opacity-35">Delete</button></div><div className="mt-3 grid grid-cols-4 gap-1"><button type="button" onClick={() => alignSelected("left")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Left</button><button type="button" onClick={() => alignSelected("center")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Center</button><button type="button" onClick={() => alignSelected("right")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Right</button><button type="button" onClick={() => alignSelected("distribute")} disabled={selectedNodeIds.size < 3} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Space</button></div><p className="mt-2 text-[10px] leading-4 text-[#667067]">Select siblings on canvas with Shift-click, then align or space them.</p></fieldset> : null}
          <label className="mb-4 block"><span className="mb-2 block text-xs text-[#667067]">Page name</span><input aria-label="Page name" value={activePage.name} onChange={(event) => renamePage(event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label>
          {selectedNode ? <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Selected node</legend><div className="space-y-3"><label className="block"><span className="mb-1 block text-xs text-[#667067]">Name</span><input aria-label="V3 node name" value={selectedNode.name} onChange={(event) => patchSelected({ name: event.target.value })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label>{selectedNode.type === "image" ? <label className="block"><span className="mb-1 block text-xs text-[#667067]">Alt text</span><input aria-label="V3 image alt text" value={selectedNode.alt} onChange={(event) => patchSelected({ alt: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label> : null}{selectedNode.type === "metric" ? <><label className="block"><span className="mb-1 block text-xs text-[#667067]">Value</span><input aria-label="V3 metric value" value={selectedNode.value} onChange={(event) => patchSelected({ value: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label className="block"><span className="mb-1 block text-xs text-[#667067]">Detail</span><input aria-label="V3 metric detail" value={selectedNode.detail} onChange={(event) => patchSelected({ detail: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></> : null}<div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node visible" type="checkbox" checked={selectedNode.visible !== false} onChange={(event) => patchSelected({ visible: event.target.checked })} />Visible</label><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node locked" type="checkbox" checked={selectedNode.locked === true} onChange={(event) => patchSelected({ locked: event.target.checked })} />Locked</label><label><span className="mb-1 block text-xs text-[#667067]">X</span><input aria-label="V3 node X" type="number" value={selectedNode.transform?.x ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, x: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Y</span><input aria-label="V3 node Y" type="number" value={selectedNode.transform?.y ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, y: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Rotation</span><input aria-label="V3 node rotation" type="number" value={selectedNode.transform?.rotation ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, rotation: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Opacity</span><input aria-label="V3 node opacity" type="number" min="0" max="1" step="0.05" value={selectedNode.opacity ?? 1} onChange={(event) => patchSelected({ opacity: Math.max(0, Math.min(1, Number(event.target.value))) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div>{selectedNode.componentRef ? <button type="button" onClick={detachComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Detach component</button> : <button type="button" onClick={makeComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Create component</button>}{editorError ? <p role="alert" className="text-[11px] text-[#B93815]">{editorError}</p> : null}</div></fieldset> : null}
          <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Assets</legend><input ref={assetInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" className="sr-only" aria-label="Upload image asset" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file); event.currentTarget.value = ""; }} /><button type="button" onClick={() => assetInputRef.current?.click()} disabled={assetState === "uploading" || assetState === "unavailable"} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#AEB6AA] bg-[#F7F8F4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6] disabled:opacity-45"><Upload size={13} />{assetState === "uploading" ? "Uploading…" : "Upload and place"}</button>{assetError ? <p role="alert" className="mt-2 text-[11px] text-[#B93815]">{assetError}</p> : null}<div className="mt-3 grid grid-cols-2 gap-2">{assets.map((asset) => <div key={asset.sha256} className="group relative overflow-hidden rounded-md border border-[#D7DBD2] bg-[#EEF0EA]"><button type="button" onClick={() => placeAsset(asset)} className="block aspect-square w-full" aria-label="Place image asset"><img src={asset.source} alt="" className="h-full w-full object-contain" /></button><button type="button" onClick={() => void deleteStoredAsset(asset)} disabled={Boolean(document.assets[asset.sha256])} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-[#B93815] opacity-0 shadow-sm group-hover:opacity-100 focus:opacity-100 disabled:hidden" aria-label="Delete image asset"><Trash2 size={11} /></button></div>)}{assetState === "ready" && assets.length === 0 ? <div className="col-span-2 flex items-center gap-2 rounded-md bg-[#F7F8F4] p-2 text-[11px] text-[#667067]"><ImageIcon size={13} />No uploaded images</div> : null}</div></fieldset>
          <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Document colors</legend><div className="space-y-3">{tokenEntries.map(([key, token]) => <label key={key} className="block"><span className="mb-1 block text-xs text-[#667067]">{key}</span><input aria-label={`Color token ${key}`} type="text" value={colorDrafts[key] ?? String(token.value)} onChange={(event) => setColorDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => commitColorToken(key)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" /></label>)}</div></fieldset>
          </details>
        </aside>
      </div>
    </main>
  );
}

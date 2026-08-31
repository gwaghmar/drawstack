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
import { dragEngineV3Node } from "@/lib/engine-v3/canvas-gestures";
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
  const [gestureGuides, setGestureGuides] = useState<SnapGuide[]>([]);
  const [collaborationConflicts, setCollaborationConflicts] = useState<ReconciliationConflict[]>([]);
  const [selectedBounds, setSelectedBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [penMode, setPenMode] = useState(false);
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
  useEffect(() => {
    const measure = () => { const element = canvasRef.current?.querySelector<HTMLElement>(`[data-node-id="${selectedNodeId}"]`); const canvas = canvasRef.current; if (!element || !canvas) return setSelectedBounds(null); const a = element.getBoundingClientRect(); const b = canvas.getBoundingClientRect(); setSelectedBounds({ left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height }); };
    measure();
    const observer = new ResizeObserver(measure);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [selectedNodeId, document, activePageId]);

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
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "a" && activePage && selectedNode) {
        event.preventDefault();
        const location = findEngineV3Node(document, activePage.id, selectedNode.id);
        const siblings = location?.parentId
          ? findEngineV3Node(document, activePage.id, location.parentId)?.node
          : activePage.root;
        if (siblings?.type === "frame") setSelectedNodeIds(new Set(siblings.children.map((node) => node.id)));
        return;
      }
      if (modifier && key === "d" && activePage && selectedNodeIds.size === 1) {
        event.preventDefault();
        const nodeId = [...selectedNodeIds][0];
        if (nodeId !== activePage.root.id) runCommand({ kind: "node", action: "duplicate", pageId: activePage.id, nodeId, precondition: { exists: true } });
        return;
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
    return () => window.removeEventListener("keydown", onKeyDown);
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
  const beginNodeDrag = (nodeId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !activePage) return;
    const location = findEngineV3Node(document, activePage.id, nodeId);
    if (!location || location.node.locked) return;
    selectNode(nodeId);
    const startX = event.clientX; const startY = event.clientY;
    const visual = visualNodeTransform(nodeId);
    const originalX = visual?.x ?? location.node.transform?.x ?? 0; const originalY = visual?.y ?? location.node.transform?.y ?? 0;
    const pageId = activePage.id; const baseDocument = historyRef.current!.snapshot().document;
    let finalX = originalX; let finalY = originalY; let moved = false;
    const move = (pointer: PointerEvent) => {
      const scale = visual?.scale ?? 1;
      finalX = originalX + (pointer.clientX - startX) * scale; finalY = originalY + (pointer.clientY - startY) * scale;
      if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) < 3) return;
      moved = true;
      try { const preview = dragEngineV3Node(baseDocument, pageId, nodeId, finalX, finalY); finalX = findEngineV3Node(preview.document, pageId, nodeId)?.node.transform?.x ?? finalX; finalY = findEngineV3Node(preview.document, pageId, nodeId)?.node.transform?.y ?? finalY; setDocument(preview.document); setGestureGuides(preview.guides); } catch { /* The committed command reports the actionable error. */ }
    };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      setGestureGuides([]);
      if (moved) {
        runCommand({ kind: "node", action: "patch", pageId, nodeId, changes: { transform: { ...(location.node.transform ?? {}), x: finalX, y: finalY } } });
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
    const startWidth = selectedBounds.width * scale; const startHeight = selectedBounds.height * scale;
    const startX = visual?.x ?? selectedNode.transform?.x ?? 0; const startY = visual?.y ?? selectedNode.transform?.y ?? 0;
    const pageId = activePage.id; const nodeId = selectedNode.id; const base = historyRef.current!.snapshot().document; let width = startWidth; let height = startHeight; let x = startX; let y = startY; let changed = false;
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - event.clientX) * scale; const dy = (pointer.clientY - event.clientY) * scale;
      if (handle.includes("e")) width = Math.max(24, startWidth + dx);
      if (handle.includes("w")) { width = Math.max(24, startWidth - dx); x = startX + startWidth - width; }
      if (handle.includes("s")) height = Math.max(24, startHeight + dy);
      if (handle.includes("n")) { height = Math.max(24, startHeight - dy); y = startY + startHeight - height; }
      changed = true;
      const changes: Partial<EngineNode> = { style: { ...selectedNode.style, width: Math.round(width), minHeight: Math.round(height) } };
      if (handle.includes("w") || handle.includes("n")) changes.transform = { ...selectedNode.transform, x: Math.round(x), y: Math.round(y) };
      try { setDocument(patchEngineV3Node(base, pageId, nodeId, changes)); } catch { /* commit below reports failures */ }
    };
    const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); if (changed) { const changes: Record<string, unknown> = { style: { ...selectedNode.style, width: Math.round(width), minHeight: Math.round(height) } }; if (handle.includes("w") || handle.includes("n")) changes.transform = { ...selectedNode.transform, x: Math.round(x), y: Math.round(y) }; runCommand({ kind: "node", action: "patch", pageId, nodeId, changes }); } };
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
  const placeAsset = (asset: StoredAsset) => {
    if (!activePage) return;
    const nodeId = `image-${crypto.randomUUID()}`;
    const assetRef = { sha256: asset.sha256, mime: asset.mime, source: asset.source, ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), ...(asset.license ? { license: asset.license } : {}) };
    const commands: EngineV3Command[] = [];
    if (!document.assets[asset.sha256]) commands.push({ kind: "asset", action: "define", asset: assetRef, precondition: { exists: false } });
    commands.push({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node: { id: nodeId, name: "Image", type: "image", assetRef: asset.sha256, alt: "Uploaded image", style: { width: Math.min(asset.width ?? 420, 720) } } });
    if (runCommand({ kind: "batch", commands })) selectNode(nodeId);
  };
  const addCanvasNode = (kind: "text" | "card" | "frame" | "circle" | "line" | "arrow") => {
    if (!activePage) return;
    const id = `${kind}-${crypto.randomUUID()}`;
    const offset = 72 + activePage.root.children.length * 12;
    const node: EngineNode = kind === "text"
      ? { id, name: "Text", type: "text", content: "Double-click to edit", variant: "heading", transform: { x: offset, y: offset }, style: { width: 280, color: "$ink" } }
      : kind === "arrow"
        ? { id, name: "Arrow", type: "text", content: "→", variant: "display", transform: { x: offset, y: offset }, style: { width: 120, color: "$cobalt" } }
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
  const duplicateSelected = () => { if (activePage && selectedNode && selectedNode.id !== activePage.root.id) runCommand({ kind: "node", action: "duplicate", pageId: activePage.id, nodeId: selectedNode.id, precondition: { exists: true } }); };
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
        router.replace(`/app/engine-v2?id=${id}&mode=v3`);
      }
      const token = await createShareLink(id);
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch {
      setShareState("error");
    }
  };
  const download = (payload: EngineV3ExportPayload) => {
    const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportActivePage = async (kind: "svg" | "html" | "tsx") => {
    try {
      const portable = await inlineEngineV3Assets(document, async (sha256) => {
        const response = await fetch(`/api/engine-v3/assets?sha256=${sha256}`);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => resolve(null); reader.readAsDataURL(blob);
        });
      });
      const payload = createEngineV3PageExports(portable, kind).find((item) => item.pageId === activePageId);
      if (payload) download(payload);
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
        <div className="flex items-center gap-1"><button type="button" onClick={undo} disabled={!historyState.canUndo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Undo" title="Undo"><Undo2 size={15} /></button><button type="button" onClick={redo} disabled={!historyState.canRedo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Redo" title="Redo"><Redo2 size={15} /></button><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md p-2 hover:bg-[#E4E7E1] xl:hidden" aria-label="Open inspector"><PanelRight size={15} /></button><button type="button" onClick={saveDocument} disabled={saveState === "saving" || saveState === "conflict"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Save document" title={saveState === "conflict" ? "Reload required" : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Save"}><Save size={15} /></button><button type="button" onClick={shareDocument} disabled={shareState === "sharing"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Share document" title={shareState === "copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}><Share2 size={15} /></button><button type="button" onClick={() => void exportActivePage("svg")} className="rounded-md p-2 hover:bg-[#E4E7E1]" aria-label="Export active page as SVG" title="Export active page as SVG"><Download size={15} /></button>{(["html", "tsx"] as const).map((kind) => <button key={kind} type="button" onClick={() => void exportActivePage(kind)} className="hidden rounded-md px-2 py-2 font-mono text-[9px] font-semibold uppercase hover:bg-[#E4E7E1] sm:block" aria-label={`Export active page as ${kind.toUpperCase()}`}>{kind}</button>)}<button type="button" onClick={() => download(createEngineV3JsonExport(document))} className="rounded-md px-2 py-2 font-mono text-[9px] font-semibold hover:bg-[#E4E7E1]" aria-label="Export document JSON">JSON</button></div>
      </header>
      {collaborationConflicts.length ? <div role="alert" className="flex items-center justify-between border-b border-[#D98A76] bg-[#FFF0EB] px-4 py-2 text-xs text-[#8B2D13]"><span>Concurrent edits touched the same item. Review the current result before saving.</span><button type="button" className="rounded border border-[#D98A76] bg-white px-2 py-1 font-semibold" onClick={() => setCollaborationConflicts([])}>Dismiss</button></div> : null}
      <section className="border-b border-[#D7DBD2] bg-[#15171A] px-4 py-3 text-white" aria-label="AI proposal editor"><form className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void requestAiProposal(); }}><input aria-label="AI edit prompt" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder={selectedNodeIds.size ? "Describe an edit to the selected nodes" : "Describe what to create"} disabled={Boolean(aiProposal)} className="min-w-[220px] flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/50 focus:border-[#B7FF4A] disabled:opacity-50" /><label className="flex items-center gap-2 px-1 text-xs"><input type="checkbox" checked={aiSafeMode} onChange={(event) => setAiSafeMode(event.target.checked)} disabled={Boolean(aiProposal)} /> Safe mode</label><button type="submit" disabled={!aiPrompt.trim() || aiState === "loading" || Boolean(aiProposal)} className="rounded-md bg-[#B7FF4A] px-3 py-2 text-xs font-semibold text-[#15171A] disabled:opacity-40">{aiState === "loading" ? "Thinking…" : "Propose"}</button></form>{aiProposal ? <div className="mx-auto mt-3 flex max-w-[1080px] flex-wrap items-center justify-between gap-3 rounded-md border border-[#B7FF4A]/40 bg-white/10 px-3 py-2 text-xs" role="status" aria-label="AI change proposal"><span><strong>Preview:</strong> {aiProposal.explanation || "Review proposed changes"} ({aiProposal.affectedIds.length} affected)</span><span className="flex gap-2"><button type="button" onClick={applyAiProposal} className="rounded bg-[#B7FF4A] px-3 py-1.5 font-semibold text-[#15171A]">Apply</button><button type="button" onClick={rejectAiProposal} className="rounded border border-white/30 px-3 py-1.5">Reject</button></span></div> : null}</section>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-[#D7DBD2] bg-white px-2 py-3" aria-label="Create tools">
          <button type="button" className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#15171A] text-white" aria-label="Select tool" title="Select"><MousePointer2 size={17} /></button>
          <button type="button" onClick={() => setPenMode((value) => !value)} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${penMode ? "bg-[#B7FF4A] text-[#15171A]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Draw with pen" aria-pressed={penMode}><Pen size={17} /><span>Pen</span></button>
          <button type="button" onClick={() => addCanvasNode("text")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add text"><Type size={17} /><span>Text</span></button>
          <button type="button" onClick={() => addCanvasNode("card")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add card"><Square size={17} /><span>Card</span></button>
          <button type="button" onClick={() => addCanvasNode("frame")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add frame"><Frame size={17} /><span>Frame</span></button>
          <button type="button" onClick={() => addCanvasNode("circle")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add circle"><Circle size={17} /><span>Circle</span></button>
          <button type="button" onClick={() => addCanvasNode("line")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add line"><Minus size={17} /><span>Line</span></button>
          <button type="button" onClick={() => addCanvasNode("arrow")} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add arrow"><ArrowUpRight size={17} /><span>Arrow</span></button>
          <button type="button" onClick={() => assetInputRef.current?.click()} className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] text-[#4F5850] hover:bg-[#EEF0EA]" aria-label="Add image"><ImageIcon size={17} /><span>Image</span></button>
          <div className="my-2 h-px w-8 bg-[#D7DBD2]" />
          <button type="button" onClick={() => setDrawer(drawer === "pages" ? null : "pages")} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${drawer === "pages" ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Show pages"><Copy size={16} /><span>Pages</span></button>
          <button type="button" onClick={() => setDrawer(drawer === "layers" ? null : "layers")} className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[9px] ${drawer === "layers" ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#4F5850] hover:bg-[#EEF0EA]"}`} aria-label="Show layers"><Layers3 size={16} /><span>Layers</span></button>
        </aside>
        {drawer === "pages" || drawer === "layers" ? <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-[#D7DBD2] bg-[#F5F6F2] p-3 max-lg:fixed max-lg:inset-y-14 max-lg:left-[68px] max-lg:z-30 max-lg:shadow-xl" aria-label={drawer === "pages" ? "Pages" : "Layers"}>
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">{drawer === "pages" ? "Pages" : "Layers"}</span><button type="button" aria-label={`Close ${drawer}`} className="rounded p-1 hover:bg-[#DDE1D9]" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          {drawer === "pages" ? <><div className="space-y-2" role="tablist" aria-label="Document pages">{document.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id} onClick={() => { setActivePageId(page.id); selectNode(page.root.id); }} className={`w-full rounded-lg border p-2 text-left ${page.id === activePage.id ? "border-[#3157F6] bg-white shadow-sm" : "border-[#D7DBD2] bg-[#F7F8F4] hover:border-[#3157F6]"}`}><div className="mb-2 flex aspect-[4/3] items-center justify-center rounded border border-[#D7DBD2] bg-white text-[10px] text-[#667067]">{page.name.slice(0, 1).toUpperCase()}</div><span className="block truncate text-xs font-medium">{page.name}</span></button>)}</div><div className="mt-3 grid grid-cols-3 gap-1"><button type="button" onClick={addPage} className="rounded-md border border-[#C8CEC4] bg-white p-2" aria-label="Add page"><Plus size={13} /></button><button type="button" onClick={duplicatePage} className="rounded-md border border-[#C8CEC4] bg-white p-2" aria-label="Duplicate page"><Copy size={13} /></button><button type="button" onClick={deletePage} disabled={document.pages.length <= 1} className="rounded-md border border-[#C8CEC4] bg-white p-2 text-[#B93815] disabled:opacity-35" aria-label="Delete page"><Trash2 size={13} /></button></div></> : <LayerTree nodes={[activePage.root]} selectedId={selectedNode?.id ?? ""} selectedIds={selectedNodeIds} onSelect={selectNode} onToggle={(id, checked) => setSelectedNodeIds((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; })} />}
        </aside> : null}
        <section className="relative min-w-0 flex-1 overflow-auto bg-[#E9EBE6] p-4 sm:p-8" aria-label="Editable canvas">
          <div className="sticky top-0 z-40 mx-auto mb-3 flex w-fit items-center gap-1 rounded-full border border-[#D7DBD2] bg-white/95 p-1 shadow-sm backdrop-blur" aria-label="Canvas zoom">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))} className="rounded-full p-1.5 text-[#566057] hover:bg-[#EEF0EA]" aria-label="Zoom out" title="Zoom out"><Minus size={13} /></button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-12 rounded-full px-2 py-1 font-mono text-[10px] font-semibold text-[#566057] hover:bg-[#EEF0EA]" aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))} className="rounded-full p-1.5 text-[#566057] hover:bg-[#EEF0EA]" aria-label="Zoom in" title="Zoom in"><Plus size={13} /></button>
          </div>
          <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 1080 : "none" }}><div ref={canvasRef} onPointerDown={beginPen} className={`relative w-full overflow-hidden rounded-xl border border-[#D7DBD2] bg-white shadow-sm ${penMode ? "cursor-crosshair" : ""}`} style={{ aspectRatio: activePage.height === "auto" ? undefined : `${activePage.width} / ${activePage.height}` }}>
          <EngineDocumentView document={activePageView} selectedIds={selectedNodeIds} onSelect={selectNode} onPointerDown={beginNodeDrag} />
          {selectedBounds && selectedNode && selectedNode.id !== activePage.root.id ? <div aria-hidden="true" className="pointer-events-none absolute z-20 border-2 border-[#3157F6]" style={{ left: selectedBounds.left, top: selectedBounds.top, width: selectedBounds.width, height: selectedBounds.height }} /> : null}
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
          {gestureGuides.map((guide, index) => guide.axis === "x" ? <div key={`${guide.axis}-${guide.position}-${index}`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[#3157F6]" style={{ left: `${guide.position / activePage.width * 100}%` }} /> : activePage.height === "auto" ? null : <div key={`${guide.axis}-${guide.position}-${index}`} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 h-px bg-[#3157F6]" style={{ top: `${guide.position / activePage.height * 100}%` }} />)}
          </div></div>
        </section>
        <aside className={`w-[272px] shrink-0 overflow-y-auto border-l border-[#D7DBD2] bg-[#EEF0EA] p-4 max-xl:fixed max-xl:inset-y-14 max-xl:right-0 max-xl:z-30 max-xl:shadow-xl ${drawer === "inspector" ? "max-xl:block" : "max-xl:hidden"}`} aria-label="Inspector">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold">Design</div><div className="text-[10px] text-[#667067]">{selectedNode?.name ?? "Page"}</div></div><button type="button" aria-label="Close inspector" className="rounded p-1 hover:bg-[#DDE1D9] xl:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          {selectedNode && selectedNode.id !== activePage.root.id ? <section className="mb-4 rounded-xl border border-[#D7DBD2] bg-white p-3" aria-label="Object colors"><div className="mb-3 text-xs font-semibold">Colors</div><div className="grid grid-cols-3 gap-2"><label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected fill color" type="color" value={resolvedStyleColor(selectedNode.style?.background, "#ffffff")} onChange={(event) => patchSelectedStyle({ background: event.target.value })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Fill</label>{selectedNode.type === "text" ? <label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected text color" type="color" value={resolvedStyleColor(selectedNode.style?.color, "#15171a")} onChange={(event) => patchSelectedStyle({ color: event.target.value })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Text</label> : <div /> }<label className="text-center text-[10px] text-[#667067]"><input aria-label="Selected border color" type="color" value={resolvedStyleColor(selectedNode.style?.borderColor, "#d7dbd2")} onChange={(event) => patchSelectedStyle({ borderColor: event.target.value, borderWidth: selectedNode.style?.borderWidth ?? 1 })} className="mb-1 h-9 w-full cursor-pointer rounded-lg border border-[#C8CEC4] bg-transparent p-1" />Border</label></div><div className="mt-3 space-y-2"><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Fill CSS</span><input aria-label="Selected fill CSS" value={typeof selectedNode.style?.background === "string" ? selectedNode.style.background : ""} onChange={(event) => patchSelectedStyle({ background: event.target.value })} placeholder="#ffffff or linear-gradient(...)" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-[10px] text-[#667067]">Stroke width</span><input aria-label="Selected stroke width" type="number" min="0" max="32" value={selectedNode.style?.borderWidth ?? 0} onChange={(event) => patchSelectedStyle({ borderWidth: Math.max(0, Math.min(32, Number(event.target.value) || 0)) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-[10px] text-[#667067]">Radius</span><input aria-label="Selected corner radius" type="number" min="0" max="999" value={selectedNode.style?.borderRadius ?? 0} onChange={(event) => patchSelectedStyle({ borderRadius: Math.max(0, Math.min(999, Number(event.target.value) || 0)) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div><label className="block"><span className="mb-1 block text-[10px] text-[#667067]">Shadow</span><input aria-label="Selected shadow" value={selectedNode.style?.boxShadow ?? ""} onChange={(event) => patchSelectedStyle({ boxShadow: event.target.value })} placeholder="0 8px 24px rgba(0,0,0,.12)" className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div></section> : null}
          {selectedNode?.type === "text" ? <label className="mb-4 block rounded-xl border border-[#D7DBD2] bg-white p-3"><span className="mb-2 block text-xs font-semibold">Text</span><textarea aria-label="Edit selected text" value={selectedNode.content} onChange={(event) => patchSelected({ content: event.target.value } as Partial<EngineNode>)} rows={4} className="w-full resize-y rounded-lg border border-[#C8CEC4] px-2 py-2 text-sm outline-none focus:border-[#3157F6]" /></label> : null}
          <details className="group"><summary className="mb-4 cursor-pointer list-none rounded-lg border border-[#C8CEC4] bg-white px-3 py-2 text-xs font-semibold">More settings</summary>
          {selectedNode && selectedNode.id !== activePage.root.id ? <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-[#D7DBD2] bg-white p-3"><label><span className="mb-1 block text-xs text-[#667067]">Width</span><input aria-label="V3 node width" type="number" min="24" value={typeof selectedNode.style?.width === "number" ? selectedNode.style.width : ""} placeholder="Auto" onChange={(event) => patchSelected({ style: { ...selectedNode.style, width: event.target.value ? Math.max(24, Number(event.target.value)) : undefined } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Height</span><input aria-label="V3 node height" type="number" min="24" value={selectedNode.style?.minHeight ?? ""} placeholder="Auto" onChange={(event) => patchSelected({ style: { ...selectedNode.style, minHeight: event.target.value ? Math.max(24, Number(event.target.value)) : undefined } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div> : null}
          {selectedNode ? <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Structure</legend><div className="grid grid-cols-3 gap-1"><button type="button" onClick={duplicateSelected} disabled={selectedNode.id === activePage.root.id} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Duplicate</button><button type="button" onClick={() => reorderSelected(-1)} disabled={!selectedLocation || selectedLocation.parentId === null || selectedLocation.index <= 0} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Move up</button><button type="button" onClick={() => reorderSelected(1)} disabled={!selectedLocation || selectedLocation.parentId === null} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Move down</button><button type="button" onClick={groupSelected} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Group</button><button type="button" onClick={ungroupSelected} disabled={selectedNode.type !== "frame" || selectedNode.id === activePage.root.id} className="rounded-md border border-[#C8CEC4] px-2 py-1.5 text-[10px] font-semibold disabled:opacity-35">Ungroup</button><button type="button" onClick={removeSelected} disabled={selectedNode.id === activePage.root.id} className="rounded-md border border-[#D98A76] px-2 py-1.5 text-[10px] font-semibold text-[#B93815] disabled:opacity-35">Delete</button></div><div className="mt-3 grid grid-cols-4 gap-1"><button type="button" onClick={() => alignSelected("left")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Left</button><button type="button" onClick={() => alignSelected("center")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Center</button><button type="button" onClick={() => alignSelected("right")} disabled={selectedNodeIds.size < 2} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Right</button><button type="button" onClick={() => alignSelected("distribute")} disabled={selectedNodeIds.size < 3} className="rounded-md border border-[#C8CEC4] px-1 py-1.5 text-[10px] disabled:opacity-35">Space</button></div><p className="mt-2 text-[10px] leading-4 text-[#667067]">Select siblings on canvas with Shift-click, then align or space them.</p></fieldset> : null}
          <label className="mb-4 block"><span className="mb-2 block text-xs text-[#667067]">Page name</span><input aria-label="Page name" value={activePage.name} onChange={(event) => renamePage(event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label>
          {selectedNode ? <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Selected node</legend><div className="space-y-3"><label className="block"><span className="mb-1 block text-xs text-[#667067]">Name</span><input aria-label="V3 node name" value={selectedNode.name} onChange={(event) => patchSelected({ name: event.target.value })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label>{selectedNode.type === "text" ? <label className="block"><span className="mb-1 block text-xs text-[#667067]">Text</span><textarea aria-label="V3 text content" value={selectedNode.content} onChange={(event) => patchSelected({ content: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label> : null}{selectedNode.type === "image" ? <label className="block"><span className="mb-1 block text-xs text-[#667067]">Alt text</span><input aria-label="V3 image alt text" value={selectedNode.alt} onChange={(event) => patchSelected({ alt: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label> : null}{selectedNode.type === "metric" ? <><label className="block"><span className="mb-1 block text-xs text-[#667067]">Value</span><input aria-label="V3 metric value" value={selectedNode.value} onChange={(event) => patchSelected({ value: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label className="block"><span className="mb-1 block text-xs text-[#667067]">Detail</span><input aria-label="V3 metric detail" value={selectedNode.detail} onChange={(event) => patchSelected({ detail: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></> : null}<div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node visible" type="checkbox" checked={selectedNode.visible !== false} onChange={(event) => patchSelected({ visible: event.target.checked })} />Visible</label><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node locked" type="checkbox" checked={selectedNode.locked === true} onChange={(event) => patchSelected({ locked: event.target.checked })} />Locked</label><label><span className="mb-1 block text-xs text-[#667067]">X</span><input aria-label="V3 node X" type="number" value={selectedNode.transform?.x ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, x: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Y</span><input aria-label="V3 node Y" type="number" value={selectedNode.transform?.y ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, y: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Rotation</span><input aria-label="V3 node rotation" type="number" value={selectedNode.transform?.rotation ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, rotation: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Opacity</span><input aria-label="V3 node opacity" type="number" min="0" max="1" step="0.05" value={selectedNode.opacity ?? 1} onChange={(event) => patchSelected({ opacity: Math.max(0, Math.min(1, Number(event.target.value))) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div>{selectedNode.componentRef ? <button type="button" onClick={detachComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Detach component</button> : <button type="button" onClick={makeComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Create component</button>}{editorError ? <p role="alert" className="text-[11px] text-[#B93815]">{editorError}</p> : null}</div></fieldset> : null}
          <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Assets</legend><input ref={assetInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" className="sr-only" aria-label="Upload image asset" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file); event.currentTarget.value = ""; }} /><button type="button" onClick={() => assetInputRef.current?.click()} disabled={assetState === "uploading" || assetState === "unavailable"} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#AEB6AA] bg-[#F7F8F4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6] disabled:opacity-45"><Upload size={13} />{assetState === "uploading" ? "Uploading…" : "Upload and place"}</button>{assetError ? <p role="alert" className="mt-2 text-[11px] text-[#B93815]">{assetError}</p> : null}<div className="mt-3 grid grid-cols-2 gap-2">{assets.map((asset) => <div key={asset.sha256} className="group relative overflow-hidden rounded-md border border-[#D7DBD2] bg-[#EEF0EA]"><button type="button" onClick={() => placeAsset(asset)} className="block aspect-square w-full" aria-label="Place image asset"><img src={asset.source} alt="" className="h-full w-full object-contain" /></button><button type="button" onClick={() => void deleteStoredAsset(asset)} disabled={Boolean(document.assets[asset.sha256])} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-[#B93815] opacity-0 shadow-sm group-hover:opacity-100 focus:opacity-100 disabled:hidden" aria-label="Delete image asset"><Trash2 size={11} /></button></div>)}{assetState === "ready" && assets.length === 0 ? <div className="col-span-2 flex items-center gap-2 rounded-md bg-[#F7F8F4] p-2 text-[11px] text-[#667067]"><ImageIcon size={13} />No uploaded images</div> : null}</div></fieldset>
          <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Document colors</legend><div className="space-y-3">{tokenEntries.map(([key, token]) => <label key={key} className="block"><span className="mb-1 block text-xs text-[#667067]">{key}</span><input aria-label={`Color token ${key}`} type="text" value={colorDrafts[key] ?? String(token.value)} onChange={(event) => setColorDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => commitColorToken(key)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" /></label>)}</div></fieldset>
          </details>
        </aside>
      </div>
    </main>
  );
}

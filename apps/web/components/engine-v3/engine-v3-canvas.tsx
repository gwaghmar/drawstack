"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Image as ImageIcon, Menu, PanelRight, Plus, Redo2, Save, Share2, Trash2, Undo2, Upload, X } from "lucide-react";
import { createEngineV2Project, saveEngineV2Project } from "@/app/actions/engine-v2";
import { createShareLink } from "@/app/actions/share";
import { EngineDocumentView } from "@/components/engine-v2/engine-canvas";
import type { EngineDocumentV3, Page } from "@/lib/engine-v3/document";
import type { EngineNode } from "@/lib/engine-v3/document";
import { duplicatePage as duplicateV3Page, removePage as removeV3Page } from "@/lib/engine-v3/operations";
import { findEngineV3Node } from "@/lib/engine-v3/node-operations";
import { defineComponent } from "@/lib/engine-v3/components";
import { createEngineV3JsonExport, createEngineV3PageExports, type EngineV3ExportPayload } from "@/lib/engine-v3/export";
import { serializeEngineV3Document } from "@/lib/engine-v3/serialization";
import { createEngineV3PageView } from "@/lib/engine-v3/view-adapter";
import { EngineV3HistoryController } from "@/lib/engine-v3/history";
import type { EngineV3Command } from "@/lib/engine-v3/commands";
import type { StoredAsset } from "@/lib/engine-v3/asset-storage";

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

function LayerTree({ nodes, selectedId, onSelect, depth = 0 }: { nodes: EngineNode[]; selectedId: string; onSelect: (id: string) => void; depth?: number }) {
  return <div role={depth ? "group" : "tree"} aria-label={depth ? undefined : "Page layers"}>{nodes.map((node) => <div key={node.id} role="treeitem" aria-selected={node.id === selectedId} aria-expanded={node.type === "frame" ? true : undefined}><button type="button" onClick={() => onSelect(node.id)} style={{ paddingLeft: 8 + depth * 12 }} className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[11px] ${node.id === selectedId ? "bg-[#DCE3FF] text-[#2448D8]" : "text-[#566057] hover:bg-white"}`}><span className="w-10 shrink-0 font-mono text-[8px] uppercase opacity-65">{node.type}</span><span className="truncate">{node.name}</span></button>{node.type === "frame" ? <LayerTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} /> : null}</div>)}</div>;
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
  const [drawer, setDrawer] = useState<"pages" | "inspector" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});
  const [editorError, setEditorError] = useState<string | null>(null);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [assetState, setAssetState] = useState<"loading" | "ready" | "uploading" | "unavailable" | "error">("loading");
  const [assetError, setAssetError] = useState<string | null>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const selectedNode = useMemo(() => activePage ? findEngineV3Node(document, activePage.id, selectedNodeId)?.node ?? activePage.root : null, [activePage, document, selectedNodeId]);
  const tokenEntries = useMemo(() => Object.entries(document.tokens.colors), [document.tokens.colors]);
  const activePageView = useMemo(() => activePage ? createEngineV3PageView(document, activePage.id) : null, [activePage, document]);
  const selectedNodeIds = useMemo(() => new Set(selectedNode ? [selectedNode.id] : []), [selectedNode]);

  const acceptHistory = (next: ReturnType<EngineV3HistoryController["snapshot"]>) => {
    setHistoryState(next);
    setDocument(next.document);
    onDocumentChange?.(next.document);
  };
  const runCommand = (command: EngineV3Command) => {
    try {
      acceptHistory(historyRef.current!.apply(command));
      setEditorError(null);
      return true;
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The change could not be applied");
      return false;
    }
  };
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
  const placeAsset = (asset: StoredAsset) => {
    if (!activePage) return;
    const nodeId = `image-${crypto.randomUUID()}`;
    const assetRef = { sha256: asset.sha256, mime: asset.mime, source: asset.source, ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), ...(asset.license ? { license: asset.license } : {}) };
    const commands: EngineV3Command[] = [];
    if (!document.assets[asset.sha256]) commands.push({ kind: "asset", action: "define", asset: assetRef, precondition: { exists: false } });
    commands.push({ kind: "node", action: "add", pageId: activePage.id, parentId: activePage.root.id, node: { id: nodeId, name: "Image", type: "image", assetRef: asset.sha256, alt: "Uploaded image", style: { width: Math.min(asset.width ?? 420, 720) } } });
    if (runCommand({ kind: "batch", commands })) setSelectedNodeId(nodeId);
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
    setSelectedNodeId(page.root.id);
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
    setSelectedNodeId(next.pages[pageIndex].root.id);
  };
  const deletePage = () => {
    if (!activePage || document.pages.length <= 1) return;
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const result = removeV3Page(document, activePage.id, activePage.id);
    if (!runCommand({ kind: "page", action: "remove", page: { id: activePage.id } })) return;
    setActivePageId(result.activePageId || result.document.pages[Math.max(0, index - 1)]?.id);
    setSelectedNodeId(result.document.pages.find((page) => page.id === result.activePageId)?.root.id ?? result.document.pages[0].root.id);
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
        router.replace(`/app/engine-v2?id=${created.id}`);
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
        router.replace(`/app/engine-v2?id=${id}`);
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
  const exportActivePage = () => {
    const payload = createEngineV3PageExports(document, "svg").find((item) => item.pageId === activePageId);
    if (payload) download(payload);
  };

  if (!activePage || !activePageView) return <main className="flex min-h-[420px] items-center justify-center bg-[#F7F8F4] text-sm text-[#667067]">Create a page to begin.</main>;
  return (
    <main className="flex min-h-[680px] flex-col overflow-hidden bg-[#F7F8F4] text-[#15171A]">
      <header className="flex min-h-14 items-center justify-between border-b border-[#D7DBD2] bg-[#F7F8F4] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><button type="button" className="rounded-md p-2 hover:bg-[#E4E7E1] lg:hidden" aria-label="Open pages" onClick={() => setDrawer("pages")}><Menu size={16} /></button><div className="truncate text-sm font-semibold">{document.metadata.name}</div><span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#667067] sm:inline">Engine v3</span></div>
        <div className="flex items-center gap-1"><button type="button" onClick={undo} disabled={!historyState.canUndo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Undo" title="Undo"><Undo2 size={15} /></button><button type="button" onClick={redo} disabled={!historyState.canRedo} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-30" aria-label="Redo" title="Redo"><Redo2 size={15} /></button><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md p-2 hover:bg-[#E4E7E1] xl:hidden" aria-label="Open inspector"><PanelRight size={15} /></button><button type="button" onClick={saveDocument} disabled={saveState === "saving" || saveState === "conflict"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Save document" title={saveState === "conflict" ? "Reload required" : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Save"}><Save size={15} /></button><button type="button" onClick={shareDocument} disabled={shareState === "sharing"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Share document" title={shareState === "copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}><Share2 size={15} /></button><button type="button" onClick={exportActivePage} className="rounded-md p-2 hover:bg-[#E4E7E1]" aria-label="Export active page as SVG" title="Export active page as SVG"><Download size={15} /></button><button type="button" onClick={() => download(createEngineV3JsonExport(document))} className="rounded-md px-2 py-2 font-mono text-[9px] font-semibold hover:bg-[#E4E7E1]" aria-label="Export document JSON">JSON</button></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className={`w-[188px] shrink-0 border-r border-[#D7DBD2] bg-[#EEF0EA] p-3 max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:z-30 max-lg:shadow-xl ${drawer === "pages" ? "max-lg:block" : "max-lg:hidden"}`} aria-label="Pages">
          <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Pages</span><button type="button" aria-label="Close pages" className="rounded p-1 hover:bg-[#DDE1D9] lg:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          <div className="space-y-2" role="tablist" aria-label="Document pages">{document.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id} onClick={() => { setActivePageId(page.id); setSelectedNodeId(page.root.id); setDrawer(null); }} className={`w-full rounded-lg border p-2 text-left ${page.id === activePage.id ? "border-[#3157F6] bg-white shadow-sm" : "border-[#D7DBD2] bg-[#F7F8F4] hover:border-[#3157F6]"}`}><div className="mb-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-[#D7DBD2] bg-white text-[10px] text-[#667067]"><span aria-hidden="true">{page.name.slice(0, 1).toUpperCase()}</span></div><span className="block truncate text-xs font-medium">{page.name}</span></button>)}</div>
          <div className="mt-3 grid grid-cols-4 gap-1"><button type="button" onClick={addPage} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6]" aria-label="Add page"><Plus size={13} /></button><button type="button" onClick={duplicatePage} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6]" aria-label="Duplicate page"><Copy size={13} /></button><button type="button" onClick={deletePage} disabled={document.pages.length <= 1} className="rounded-md border border-[#C8CEC4] bg-white p-2 text-[#B93815] hover:border-[#B93815] disabled:opacity-35" aria-label="Delete page"><Trash2 size={13} /></button><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6] lg:hidden" aria-label="Open inspector">i</button></div>
          <div className="mt-5 border-t border-[#D7DBD2] pt-3"><div className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Layers</div><LayerTree nodes={[activePage.root]} selectedId={selectedNode?.id ?? ""} onSelect={setSelectedNodeId} /></div>
        </aside>
        <section className="min-w-0 flex-1 overflow-auto p-4 sm:p-8" aria-label="Editable canvas"><div className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-xl border border-[#D7DBD2] bg-white shadow-sm" style={{ aspectRatio: activePage.height === "auto" ? undefined : `${activePage.width} / ${activePage.height}` }}><EngineDocumentView document={activePageView} selectedIds={selectedNodeIds} onSelect={(id) => setSelectedNodeId(id)} /></div></section>
        <aside className={`w-[272px] shrink-0 overflow-y-auto border-l border-[#D7DBD2] bg-[#EEF0EA] p-4 max-xl:fixed max-xl:inset-y-14 max-xl:right-0 max-xl:z-30 max-xl:shadow-xl ${drawer === "inspector" ? "max-xl:block" : "max-xl:hidden"}`} aria-label="Inspector">
          <div className="mb-4 flex items-center justify-between"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Page inspector</span><button type="button" aria-label="Close inspector" className="rounded p-1 hover:bg-[#DDE1D9] xl:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          <label className="mb-4 block"><span className="mb-2 block text-xs text-[#667067]">Page name</span><input aria-label="Page name" value={activePage.name} onChange={(event) => renamePage(event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label>
          {selectedNode ? <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Selected node</legend><div className="space-y-3"><label className="block"><span className="mb-1 block text-xs text-[#667067]">Name</span><input aria-label="V3 node name" value={selectedNode.name} onChange={(event) => patchSelected({ name: event.target.value })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label>{selectedNode.type === "text" ? <label className="block"><span className="mb-1 block text-xs text-[#667067]">Text</span><textarea aria-label="V3 text content" value={selectedNode.content} onChange={(event) => patchSelected({ content: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label> : null}{selectedNode.type === "image" ? <label className="block"><span className="mb-1 block text-xs text-[#667067]">Alt text</span><input aria-label="V3 image alt text" value={selectedNode.alt} onChange={(event) => patchSelected({ alt: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label> : null}{selectedNode.type === "metric" ? <><label className="block"><span className="mb-1 block text-xs text-[#667067]">Value</span><input aria-label="V3 metric value" value={selectedNode.value} onChange={(event) => patchSelected({ value: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label className="block"><span className="mb-1 block text-xs text-[#667067]">Detail</span><input aria-label="V3 metric detail" value={selectedNode.detail} onChange={(event) => patchSelected({ detail: event.target.value } as Partial<EngineNode>)} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></> : null}<div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node visible" type="checkbox" checked={selectedNode.visible !== false} onChange={(event) => patchSelected({ visible: event.target.checked })} />Visible</label><label className="flex items-center gap-2 text-xs"><input aria-label="V3 node locked" type="checkbox" checked={selectedNode.locked === true} onChange={(event) => patchSelected({ locked: event.target.checked })} />Locked</label><label><span className="mb-1 block text-xs text-[#667067]">X</span><input aria-label="V3 node X" type="number" value={selectedNode.transform?.x ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, x: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Y</span><input aria-label="V3 node Y" type="number" value={selectedNode.transform?.y ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, y: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Rotation</span><input aria-label="V3 node rotation" type="number" value={selectedNode.transform?.rotation ?? 0} onChange={(event) => patchSelected({ transform: { ...selectedNode.transform, rotation: Number(event.target.value) || 0 } })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label><label><span className="mb-1 block text-xs text-[#667067]">Opacity</span><input aria-label="V3 node opacity" type="number" min="0" max="1" step="0.05" value={selectedNode.opacity ?? 1} onChange={(event) => patchSelected({ opacity: Math.max(0, Math.min(1, Number(event.target.value))) })} className="w-full rounded-md border border-[#C8CEC4] px-2 py-1.5 text-xs" /></label></div>{selectedNode.componentRef ? <button type="button" onClick={detachComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Detach component</button> : <button type="button" onClick={makeComponent} className="w-full rounded-md border border-[#C8CEC4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6]">Create component</button>}{editorError ? <p role="alert" className="text-[11px] text-[#B93815]">{editorError}</p> : null}</div></fieldset> : null}
          <fieldset className="mb-4 rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Assets</legend><input ref={assetInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" className="sr-only" aria-label="Upload image asset" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file); event.currentTarget.value = ""; }} /><button type="button" onClick={() => assetInputRef.current?.click()} disabled={assetState === "uploading" || assetState === "unavailable"} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#AEB6AA] bg-[#F7F8F4] px-2 py-2 text-xs font-semibold hover:border-[#3157F6] disabled:opacity-45"><Upload size={13} />{assetState === "uploading" ? "Uploading…" : "Upload and place"}</button>{assetError ? <p role="alert" className="mt-2 text-[11px] text-[#B93815]">{assetError}</p> : null}<div className="mt-3 grid grid-cols-2 gap-2">{assets.map((asset) => <div key={asset.sha256} className="group relative overflow-hidden rounded-md border border-[#D7DBD2] bg-[#EEF0EA]"><button type="button" onClick={() => placeAsset(asset)} className="block aspect-square w-full" aria-label="Place image asset"><img src={asset.source} alt="" className="h-full w-full object-contain" /></button><button type="button" onClick={() => void deleteStoredAsset(asset)} disabled={Boolean(document.assets[asset.sha256])} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-[#B93815] opacity-0 shadow-sm group-hover:opacity-100 focus:opacity-100 disabled:hidden" aria-label="Delete image asset"><Trash2 size={11} /></button></div>)}{assetState === "ready" && assets.length === 0 ? <div className="col-span-2 flex items-center gap-2 rounded-md bg-[#F7F8F4] p-2 text-[11px] text-[#667067]"><ImageIcon size={13} />No uploaded images</div> : null}</div></fieldset>
          <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Color tokens</legend><div className="space-y-3">{tokenEntries.map(([key, token]) => <label key={key} className="block"><span className="mb-1 block text-xs text-[#667067]">{key}</span><input aria-label={`Color token ${key}`} type="text" value={colorDrafts[key] ?? String(token.value)} onChange={(event) => setColorDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => commitColorToken(key)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" /></label>)}</div></fieldset>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Menu, PanelRight, Plus, Save, Share2, Trash2, X } from "lucide-react";
import { createEngineV2Project, saveEngineV2Project } from "@/app/actions/engine-v2";
import { createShareLink } from "@/app/actions/share";
import { EngineDocumentView } from "@/components/engine-v2/engine-canvas";
import type { EngineDocumentV3, Page } from "@/lib/engine-v3/document";
import { addPage as addV3Page, duplicatePage as duplicateV3Page, removePage as removeV3Page } from "@/lib/engine-v3/operations";
import { createEngineV3JsonExport, createEngineV3PageExports, type EngineV3ExportPayload } from "@/lib/engine-v3/export";
import { serializeEngineV3Document } from "@/lib/engine-v3/serialization";
import { createEngineV3PageView } from "@/lib/engine-v3/view-adapter";

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

export function EngineV3Canvas({ initialDocument, initialProjectId = null, initialUpdatedAt = null, onDocumentChange }: EngineV3CanvasProps) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [activePageId, setActivePageId] = useState(initialDocument.pages[0]?.id ?? "");
  const [drawer, setDrawer] = useState<"pages" | "inspector" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const tokenEntries = useMemo(() => Object.entries(document.tokens.colors), [document.tokens.colors]);
  const activePageView = useMemo(() => activePage ? createEngineV3PageView(document, activePage.id) : null, [activePage, document]);

  const commit = (next: EngineDocumentV3) => {
    setDocument(next);
    onDocumentChange?.(next);
  };
  const updatePage = (pageId: string, update: (page: Page) => Page) => commit({ ...document, pages: document.pages.map((page) => page.id === pageId ? update(page) : page), metadata: { ...document.metadata, updatedAt: new Date().toISOString() } });
  const addPage = () => {
    const id = "page-" + crypto.randomUUID();
    const page: Page = { id, name: pageName(document.pages, "Untitled page"), width: 1080, height: 720, background: "#F7F8F4", root: { id: id + "-root", name: "Page", type: "frame", layout: { mode: "flex", direction: "column", gap: 0, padding: 32 }, children: [] } };
    const result = addV3Page(document, page, document.pages.length, activePageId);
    commit({ ...result.document, metadata: { ...result.document.metadata, updatedAt: new Date().toISOString() } });
    setActivePageId(id);
  };
  const duplicatePage = () => {
    if (!activePage) return;
    const id = "page-" + crypto.randomUUID();
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const next = duplicateV3Page(document, activePage.id, id, index + 1);
    const pageIndex = next.pages.findIndex((page) => page.id === id);
    next.pages[pageIndex] = { ...next.pages[pageIndex], name: pageName(document.pages, activePage.name + " copy") };
    commit({ ...next, metadata: { ...next.metadata, updatedAt: new Date().toISOString() } });
    setActivePageId(id);
  };
  const deletePage = () => {
    if (!activePage || document.pages.length <= 1) return;
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const result = removeV3Page(document, activePage.id, activePage.id);
    commit({ ...result.document, metadata: { ...result.document.metadata, updatedAt: new Date().toISOString() } });
    setActivePageId(result.activePageId || result.document.pages[Math.max(0, index - 1)]?.id);
  };
  const renamePage = (name: string) => {
    if (activePage && name.trim()) updatePage(activePage.id, (page) => ({ ...page, name: name.trim() }));
  };
  const updateColorToken = (key: string, value: string) => {
    const colors = { ...document.tokens.colors, [key]: { ...document.tokens.colors[key], value } };
    commit({ ...document, tokens: { ...document.tokens, colors }, metadata: { ...document.metadata, updatedAt: new Date().toISOString() } });
  };
  const commitColorToken = (key: string) => {
    const value = colorDrafts[key];
    if (value === undefined) return;
    if (value.trim() && !/[<>`]/.test(value)) updateColorToken(key, value.trim());
    setColorDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
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
        <div className="flex items-center gap-1"><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md p-2 hover:bg-[#E4E7E1] xl:hidden" aria-label="Open inspector"><PanelRight size={15} /></button><button type="button" onClick={saveDocument} disabled={saveState === "saving" || saveState === "conflict"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Save document" title={saveState === "conflict" ? "Reload required" : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Save"}><Save size={15} /></button><button type="button" onClick={shareDocument} disabled={shareState === "sharing"} className="rounded-md p-2 hover:bg-[#E4E7E1] disabled:opacity-40" aria-label="Share document" title={shareState === "copied" ? "Link copied" : shareState === "error" ? "Share failed" : "Share"}><Share2 size={15} /></button><button type="button" onClick={exportActivePage} className="rounded-md p-2 hover:bg-[#E4E7E1]" aria-label="Export active page as SVG" title="Export active page as SVG"><Download size={15} /></button><button type="button" onClick={() => download(createEngineV3JsonExport(document))} className="rounded-md px-2 py-2 font-mono text-[9px] font-semibold hover:bg-[#E4E7E1]" aria-label="Export document JSON">JSON</button></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className={`w-[188px] shrink-0 border-r border-[#D7DBD2] bg-[#EEF0EA] p-3 max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:z-30 max-lg:shadow-xl ${drawer === "pages" ? "max-lg:block" : "max-lg:hidden"}`} aria-label="Pages">
          <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Pages</span><button type="button" aria-label="Close pages" className="rounded p-1 hover:bg-[#DDE1D9] lg:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          <div className="space-y-2" role="tablist" aria-label="Document pages">{document.pages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={page.id === activePage.id} onClick={() => { setActivePageId(page.id); setDrawer(null); }} className={`w-full rounded-lg border p-2 text-left ${page.id === activePage.id ? "border-[#3157F6] bg-white shadow-sm" : "border-[#D7DBD2] bg-[#F7F8F4] hover:border-[#3157F6]"}`}><div className="mb-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-[#D7DBD2] bg-white text-[10px] text-[#667067]"><span aria-hidden="true">{page.name.slice(0, 1).toUpperCase()}</span></div><span className="block truncate text-xs font-medium">{page.name}</span></button>)}</div>
          <div className="mt-3 grid grid-cols-4 gap-1"><button type="button" onClick={addPage} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6]" aria-label="Add page"><Plus size={13} /></button><button type="button" onClick={duplicatePage} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6]" aria-label="Duplicate page"><Copy size={13} /></button><button type="button" onClick={deletePage} disabled={document.pages.length <= 1} className="rounded-md border border-[#C8CEC4] bg-white p-2 text-[#B93815] hover:border-[#B93815] disabled:opacity-35" aria-label="Delete page"><Trash2 size={13} /></button><button type="button" onClick={() => setDrawer("inspector")} className="rounded-md border border-[#C8CEC4] bg-white p-2 hover:border-[#3157F6] lg:hidden" aria-label="Open inspector">i</button></div>
        </aside>
        <section className="min-w-0 flex-1 overflow-auto p-4 sm:p-8" aria-label="Canvas preview"><div className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-xl border border-[#D7DBD2] bg-white shadow-sm" style={{ aspectRatio: activePage.height === "auto" ? undefined : `${activePage.width} / ${activePage.height}` }}><EngineDocumentView document={activePageView} /></div></section>
        <aside className={`w-[272px] shrink-0 overflow-y-auto border-l border-[#D7DBD2] bg-[#EEF0EA] p-4 max-xl:fixed max-xl:inset-y-14 max-xl:right-0 max-xl:z-30 max-xl:shadow-xl ${drawer === "inspector" ? "max-xl:block" : "max-xl:hidden"}`} aria-label="Inspector">
          <div className="mb-4 flex items-center justify-between"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Page inspector</span><button type="button" aria-label="Close inspector" className="rounded p-1 hover:bg-[#DDE1D9] xl:hidden" onClick={() => setDrawer(null)}><X size={14} /></button></div>
          <label className="mb-4 block"><span className="mb-2 block text-xs text-[#667067]">Page name</span><input aria-label="Page name" value={activePage.name} onChange={(event) => renamePage(event.target.value)} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2.5 text-sm outline-none focus:border-[#3157F6]" /></label>
          <fieldset className="rounded-lg border border-[#D7DBD2] bg-white p-3"><legend className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#667067]">Color tokens</legend><div className="space-y-3">{tokenEntries.map(([key, token]) => <label key={key} className="block"><span className="mb-1 block text-xs text-[#667067]">{key}</span><input aria-label={`Color token ${key}`} type="text" value={colorDrafts[key] ?? String(token.value)} onChange={(event) => setColorDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => commitColorToken(key)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-full rounded-lg border border-[#C8CEC4] bg-white p-2 text-xs outline-none focus:border-[#3157F6]" /></label>)}</div></fieldset>
        </aside>
      </div>
    </main>
  );
}

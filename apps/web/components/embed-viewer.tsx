"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";

const FreeformRenderer = dynamic(
  () => import("./diagrams/freeform-renderer").then((m) => m.FreeformRenderer),
  { ssr: false }
);
const EngineDocumentView = dynamic(
  () => import("./engine-v2/engine-canvas").then((module) => module.EngineDocumentView),
  { ssr: false },
);

type ShareData = {
  title: string;
  source: string;
  themeId: string;
  diagramType: string;
};

export function EmbedViewer({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceCopied, setSourceCopied] = useState(false);
  const engineDocument = useMemo(() => {
    if (data?.diagramType !== "engine-v2") return null;
    try {
      const result = validateEngineV2Document(JSON.parse(data.source) as unknown);
      return result.ok ? result.document : null;
    } catch {
      return null;
    }
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError(res.status === 410 ? "This embed link has expired." : "This link is invalid.");
        return;
      }
      const j = await res.json();
      if (!cancelled) setData({ ...j, diagramType: j.diagramType ?? "freeform" });
    })();
    return () => { cancelled = true; };
  }, [token]);

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
    <div className="group relative h-screen w-screen overflow-hidden bg-white">
      <button
        onClick={copySource}
        title="Copy diagram source"
        className="absolute bottom-2 right-2 z-10 rounded border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500 opacity-0 backdrop-blur-sm transition-opacity hover:text-slate-800 group-hover:opacity-100"
      >
        {sourceCopied ? "Copied!" : "</> source"}
      </button>
      {engineDocument ? <EngineDocumentView document={engineDocument} className="mx-auto" /> : <FreeformRenderer source={data.source} readOnly onChange={() => {}} />}
    </div>
  );
}

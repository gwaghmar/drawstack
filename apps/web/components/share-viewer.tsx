"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toPng } from "html-to-image";
import Link from "next/link";
import type { DiagramType } from "@flowchart/core";
import { downloadSource, sourceFileExtension } from "@/lib/diagrams/source-export";
import { parseSharedEngineV2Document } from "@/lib/engine-v2/shared-document";

// Lazy-load heavy renderer so it doesn't bloat the share page bundle
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

export function ShareViewer({ token, authorHandle }: { token: string; authorHandle?: string | null }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceCopied, setSourceCopied] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const engineDocument = useMemo(() => {
    return data ? parseSharedEngineV2Document(data.diagramType, data.source) : null;
  }, [data]);

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
      if (!cancelled) setData({ ...j, diagramType: j.diagramType ?? "freeform" });
    })();
    return () => { cancelled = true; };
  }, [token]);

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

  const diagramType = data?.diagramType ?? "freeform";
  const DIAGRAM_TYPE_LABELS: Record<string, string> = {
    freeform: "Free Canvas",
    "engine-v2": "Engine v2 document",
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
              {data && diagramType !== "engine-v2" ? (
                <button
                  onClick={() => downloadSource(data.source, diagramType as DiagramType, data.title || "diagram")}
                  className="rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {`Download .${sourceFileExtension(diagramType as DiagramType)}`}
                </button>
              ) : null}
            </div>

            <div
              ref={frameRef}
              className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white"
              style={{ minHeight: "400px" }}
            >
              {engineDocument ? (
                <EngineDocumentView document={engineDocument} className="mx-auto" />
              ) : data.diagramType === "engine-v2" ? (
                <div className="flex h-[400px] items-center justify-center text-sm text-red-600">This Engine v2 document is invalid.</div>
              ) : (
                <div className="h-[600px]"><FreeformRenderer source={data.source} readOnly onChange={() => {}} /></div>
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

"use client";

import { useState } from "react";
import { EngineDocumentView } from "@/components/engine-v2/engine-canvas";
import type { EngineDocumentV3 } from "@/lib/engine-v3/document";
import { createEngineV3PageView } from "@/lib/engine-v3/view-adapter";

export function EngineV3DocumentView({ document, className = "" }: { document: EngineDocumentV3; className?: string }) {
  const [pageId, setPageId] = useState(document.pages[0]?.id ?? "");
  const page = document.pages.find((candidate) => candidate.id === pageId) ?? document.pages[0];
  if (!page) return null;
  return (
    <div className={className}>
      {document.pages.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-[#D7DBD2] bg-[#EEF0EA] p-2" role="tablist" aria-label="Shared document pages">
          {document.pages.map((candidate) => <button key={candidate.id} type="button" role="tab" aria-selected={candidate.id === page.id} onClick={() => setPageId(candidate.id)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${candidate.id === page.id ? "bg-[#3157F6] text-white" : "bg-white text-[#566057] hover:bg-[#E4E7E1]"}`}>{candidate.name}</button>)}
        </div>
      ) : null}
      <EngineDocumentView document={createEngineV3PageView(document, page.id)} className="mx-auto" />
    </div>
  );
}

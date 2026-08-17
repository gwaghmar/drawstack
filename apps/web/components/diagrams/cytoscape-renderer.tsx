"use client";

import { useEffect, useRef, useState } from "react";

type CytoscapeRendererProps = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

export function CytoscapeRenderer({ source }: CytoscapeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(source);
    } catch {
      setError("Invalid JSON — could not parse Cytoscape spec.");
      return;
    }
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cy: any;

      import("cytoscape").then((cytoscapeModule) => {
      const cytoscape = cytoscapeModule.default;

      if (cyRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cyRef.current as any).destroy();
        cyRef.current = null;
      }

      if (!containerRef.current) return;

      cy = cytoscape({
        container: containerRef.current,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: spec.elements as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layout: (spec.layout as any) ?? { name: "cose" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: (spec.style as any) ?? [
          {
            selector: "node",
            style: {
              "background-color": "#06b6d4",
              label: "data(label)",
              color: "#fff",
              "font-size": 13,
              "text-valign": "center",
              "text-halign": "center",
              width: 120,
              height: 44,
              shape: "roundrectangle",
              "font-family": "Inter, system-ui, sans-serif",
              "text-wrap": "wrap",
              "text-max-width": 110,
            },
          },
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "#94a3b8",
              "target-arrow-color": "#94a3b8",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(label)",
              "font-size": 10,
              "font-family": "Inter, system-ui, sans-serif",
              "text-background-color": "#fff",
              "text-background-opacity": 1,
              "text-background-padding": "3px",
              color: "#64748b",
            },
          },
        ],
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
      });

      cyRef.current = cy;
    });

    return () => {
      if (cyRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cyRef.current as any).destroy();
        cyRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div className="relative w-full h-full bg-white">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-sm text-center">
            <p className="text-red-700 font-medium text-sm">Cytoscape render error</p>
            <p className="text-red-500 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type VisNetworkRendererProps = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

export function VisNetworkRenderer({ source, onChange }: VisNetworkRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const networkRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(source);
    } catch {
      setError("Invalid JSON — could not parse vis-network spec.");
      return;
    }
    setError(null);

    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    import("vis-network").then(({ Network, DataSet }) => {
      if (!containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawNodes = (spec.nodes as any[]) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawEdges = (spec.edges as any[]) ?? [];

      const nodes = new DataSet(rawNodes);
      const edges = new DataSet(rawEdges);

      const options = (spec.options as Record<string, unknown>) ?? {};

      const network = new Network(
        containerRef.current,
        { nodes, edges },
        {
          physics: {
            enabled: true,
            solver: "forceAtlas2Based",
            stabilization: { iterations: 200 },
          },
          layout: { improvedLayout: true },
          nodes: {
            shape: "dot",
            font: { size: 14, face: "Inter, system-ui, sans-serif", color: "#1e293b" },
            borderWidth: 2,
            shadow: true,
          },
          edges: {
            font: { size: 10, face: "Inter, system-ui, sans-serif", color: "#64748b", align: "middle" },
            smooth: { type: "cubicBezier", enabled: true, roundness: 0.5 },
            shadow: false,
          },
          interaction: {
            hover: true,
            tooltipDelay: 200,
          },
          ...options,
        }
      );

      networkRef.current = network;

      network.once("stabilizationIterationsDone", () => {
        if (onChange) {
          const positions = network.getPositions();
          try {
            const updatedSpec = { ...spec };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updatedSpec.nodes as any[]) = rawNodes.map((n: any) => ({
              ...n,
              x: positions[n.id]?.x ?? n.x,
              y: positions[n.id]?.y ?? n.y,
            }));
            const updatedOptions = { ...(options as Record<string, unknown>) };
            if (updatedOptions.physics && typeof updatedOptions.physics === "object") {
              updatedOptions.physics = { ...(updatedOptions.physics as object), enabled: false };
            } else {
              updatedOptions.physics = { enabled: false };
            }
            updatedSpec.options = updatedOptions;
            onChange(JSON.stringify(updatedSpec, null, 2));
          } catch {
            // silent — positions save is best-effort
          }
        }
      });
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div className="relative w-full h-full bg-white">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-sm text-center">
            <p className="text-red-700 font-medium text-sm">vis-network render error</p>
            <p className="text-red-500 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

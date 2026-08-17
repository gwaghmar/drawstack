"use client";

import { useEffect, useRef, useState } from "react";

type FabricRendererProps = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

export function FabricRenderer({ source, onChange, readOnly }: FabricRendererProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const onChangeSuppressedRef = useRef(false);

  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(source);
    } catch {
      setError("Invalid JSON — could not parse Fabric.js canvas spec.");
      return;
    }
    setError(null);

    import("fabric").then(({ Canvas }) => {
      if (!canvasElRef.current || !containerRef.current) return;

      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }

      const containerW = containerRef.current.clientWidth || 800;
      const containerH = containerRef.current.clientHeight || 600;
      const specW = (spec.width as number) ?? 800;
      const specH = (spec.height as number) ?? 600;
      const scale = Math.min(containerW / specW, containerH / specH, 1);

      const canvas = new Canvas(canvasElRef.current, {
        width: specW * scale,
        height: specH * scale,
        backgroundColor: (spec.background as string) ?? "#f8fafc",
        selection: !readOnly,
        isDrawingMode: false,
      });

      canvas.setZoom(scale);
      fabricRef.current = canvas;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.loadFromJSON(spec as any).then(() => {
        canvas.renderAll();
      });

      if (!readOnly && onChange) {
        canvas.on("object:modified", () => {
          if (onChangeSuppressedRef.current) return;
          const json = canvas.toJSON();
          onChange(JSON.stringify(json, null, 2));
        });
        canvas.on("object:added", () => {
          if (onChangeSuppressedRef.current) return;
          const json = canvas.toJSON();
          onChange(JSON.stringify(json, null, 2));
        });
        canvas.on("object:removed", () => {
          if (onChangeSuppressedRef.current) return;
          const json = canvas.toJSON();
          onChange(JSON.stringify(json, null, 2));
        });
      }
    });

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-slate-100 overflow-auto"
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-sm text-center">
            <p className="text-red-700 font-medium text-sm">Fabric.js render error</p>
            <p className="text-red-500 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
      <canvas ref={canvasElRef} />
    </div>
  );
}

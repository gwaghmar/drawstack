"use client";

import { useEffect, useRef, useState } from "react";

type PixiRendererProps = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

type PixiStageObject =
  | { type: "circle"; id?: string; x: number; y: number; radius: number; fill: string; alpha?: number; label?: string }
  | { type: "rect"; id?: string; x: number; y: number; width: number; height: number; fill: string; cornerRadius?: number; label?: string }
  | { type: "line"; from?: string; to?: string; x1?: number; y1?: number; x2?: number; y2?: number; color: string; width?: number }
  | { type: "text"; x: number; y: number; content: string; fontSize?: number; fill?: string }
  | { type: "particle"; count: number; area: [number, number, number, number]; color: string; speed?: number; radius?: number; alpha?: number };

type PixiSpec = {
  config: {
    width?: number;
    height?: number;
    background?: string;
    antialias?: boolean;
  };
  stage: PixiStageObject[];
};

function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export function PixiRenderer({ source }: PixiRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<unknown>(null);
  const tickerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let spec: PixiSpec;
    try {
      spec = JSON.parse(source);
    } catch {
      setError("Invalid JSON — could not parse PixiJS spec.");
      return;
    }
    setError(null);

    const cfg = spec.config ?? {};
    const W = cfg.width ?? 800;
    const H = cfg.height ?? 600;
    const bg = cfg.background ?? "#0f172a";

    let destroyed = false;

    import("pixi.js").then(({ Application, Graphics, Text, TextStyle, Ticker }) => {
      if (destroyed || !canvasRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new (Application as any)();
      appRef.current = app;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).init({
        canvas: canvasRef.current,
        width: W,
        height: H,
        background: hexToNumber(bg),
        antialias: cfg.antialias ?? true,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
      }).then(() => {
        if (destroyed) return;

        const nodePositions = new Map<string, { x: number; y: number }>();

        // Build a map of id→position first pass
        for (const obj of spec.stage) {
          if ("id" in obj && obj.id) {
            if (obj.type === "circle") nodePositions.set(obj.id, { x: obj.x, y: obj.y });
            if (obj.type === "rect") nodePositions.set(obj.id, { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 });
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stage = (app as any).stage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const particles: Array<{ g: any; vx: number; vy: number; speed: number }> = [];

        for (const obj of spec.stage) {
          if (obj.type === "particle") {
            const [ax, ay, aw, ah] = obj.area;
            for (let i = 0; i < obj.count; i++) {
              const g = new Graphics();
              const x = ax + Math.random() * aw;
              const y = ay + Math.random() * ah;
              g.circle(0, 0, obj.radius ?? 2).fill({
                color: hexToNumber(obj.color),
                alpha: obj.alpha ?? 0.5,
              });
              g.x = x;
              g.y = y;
              stage.addChild(g);
              particles.push({
                g,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                speed: obj.speed ?? 0.5,
              });
            }
          } else if (obj.type === "line") {
            const g = new Graphics();
            let x1 = obj.x1 ?? 0;
            let y1 = obj.y1 ?? 0;
            let x2 = obj.x2 ?? 0;
            let y2 = obj.y2 ?? 0;
            if (obj.from && nodePositions.has(obj.from)) {
              ({ x: x1, y: y1 } = nodePositions.get(obj.from)!);
            }
            if (obj.to && nodePositions.has(obj.to)) {
              ({ x: x2, y: y2 } = nodePositions.get(obj.to)!);
            }
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: hexToNumber(obj.color), width: obj.width ?? 1.5, alpha: 0.6 });
            stage.addChild(g);
          } else if (obj.type === "circle") {
            const g = new Graphics();
            g.circle(0, 0, obj.radius).fill({ color: hexToNumber(obj.fill), alpha: obj.alpha ?? 1 });
            g.x = obj.x;
            g.y = obj.y;
            stage.addChild(g);
            if (obj.label) {
              const t = new Text({
                text: obj.label,
                style: new TextStyle({ fontSize: 12, fill: 0xf1f5f9, fontFamily: "Inter, system-ui, sans-serif" }),
              });
              t.anchor.set(0.5);
              t.x = obj.x;
              t.y = obj.y + obj.radius + 14;
              stage.addChild(t);
            }
          } else if (obj.type === "rect") {
            const g = new Graphics();
            g.roundRect(0, 0, obj.width, obj.height, obj.cornerRadius ?? 0).fill({ color: hexToNumber(obj.fill) });
            g.x = obj.x;
            g.y = obj.y;
            stage.addChild(g);
            if (obj.label) {
              const t = new Text({
                text: obj.label,
                style: new TextStyle({ fontSize: 12, fill: 0xf1f5f9, fontFamily: "Inter, system-ui, sans-serif" }),
              });
              t.anchor.set(0.5);
              t.x = obj.x + obj.width / 2;
              t.y = obj.y + obj.height / 2;
              stage.addChild(t);
            }
          } else if (obj.type === "text") {
            const t = new Text({
              text: obj.content,
              style: new TextStyle({
                fontSize: obj.fontSize ?? 14,
                fill: obj.fill ? hexToNumber(obj.fill) : 0xf1f5f9,
                fontFamily: "Inter, system-ui, sans-serif",
              }),
            });
            t.anchor.set(0.5);
            t.x = obj.x;
            t.y = obj.y;
            stage.addChild(t);
          }
        }

        if (particles.length > 0) {
          const ticker = new Ticker();
          tickerRef.current = ticker;
          ticker.add(() => {
            for (const p of particles) {
              p.g.x += p.vx * p.speed;
              p.g.y += p.vy * p.speed;
              if (p.g.x < 0 || p.g.x > W) p.vx *= -1;
              if (p.g.y < 0 || p.g.y > H) p.vy *= -1;
            }
          });
          ticker.start();
        }
      });
    });

    return () => {
      destroyed = true;
      if (tickerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tickerRef.current as any).destroy();
        tickerRef.current = null;
      }
      if (appRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appRef.current as any).destroy(false, { children: true });
        appRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-auto">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 z-10">
          <div className="bg-red-950 border border-red-800 rounded-lg p-6 max-w-sm text-center">
            <p className="text-red-300 font-medium text-sm">PixiJS render error</p>
            <p className="text-red-400 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
}

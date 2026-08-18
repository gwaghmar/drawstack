const fs = require('fs');

let content = fs.readFileSync('apps/web/components/diagrams/freeform-renderer.tsx', 'utf8');

// Fix React import
content = content.replace(
  'import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type ReactNode } from "react";',
  'import React, { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type ReactNode } from "react";'
);

// 1. Add imports
const imports = `import { LiveProvider, LiveError, LivePreview, LiveContext } from "react-live";
import { Html } from "react-konva-utils";
import { Form } from "../canvas-ui/Form";
import { Slider } from "../canvas-ui/Slider";
import { Toggle } from "../canvas-ui/Toggle";
import { Select } from "../canvas-ui/Select";
import { Card } from "../canvas-ui/Card";
import { DataTable } from "../canvas-ui/DataTable";
import { Input } from "../canvas-ui/Input";
import { Button } from "../canvas-ui/Button";
import { Badge } from "../canvas-ui/Badge";
import { Tabs } from "../canvas-ui/Tabs";
import { Typography } from "../canvas-ui/Typography";
import { Icon } from "../canvas-ui/Icon";
import { BarChart } from "../canvas-ui/charts/BarChart";
import { DonutChart } from "../canvas-ui/charts/DonutChart";
import { LineChart } from "../canvas-ui/charts/LineChart";
import { ThemeProvider } from "../canvas-ui/ThemeProvider";
`;

content = content.replace(
  'import { getStroke } from "perfect-freehand";',
  'import { getStroke } from "perfect-freehand";\n' + imports
);

// 2. Add SelfHealingError and Hooks
const selfHealingError = `
const SelfHealingError = ({ shapeId, code, onHealShape }: { shapeId: string, code: string, onHealShape: (id: string, code: string) => void }) => {
  const context = React.useContext(LiveContext);
  React.useEffect(() => {
    if (context.error) {
      console.log("Self healing triggered for error:", context.error);
      fetch('/api/ai/repair-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, error: context.error?.toString() ?? "Unknown error" })
      }).then(res => res.json()).then(data => {
        if (data.fixedCode) {
          onHealShape(shapeId, data.fixedCode);
        }
      }).catch(console.error);
    }
  }, [context.error, shapeId, code, onHealShape]);
  return <LiveError style={{ color: "red", background: "#fee2e2", padding: "8px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace", overflow: "auto", maxHeight: "100%" }} />;
};
`;

content = content.replace(
  '// ─── Table cell editing (Konva-side only) ─────────────────────────────────',
  selfHealingError + '\n// ─── Table cell editing (Konva-side only) ─────────────────────────────────'
);

// 3. Add useDataFetch and useSharedState logic to FreeformRenderer
const hookLogic = `
  const onHealShape = React.useCallback((id: string, code: string) => {
    const doc = parseFreeformSource(source).doc;
    if (!doc) return;
    const newDoc = {
      ...doc,
      shapes: doc.shapes.map(s => s.id === id && s.type === "ui_node" ? { ...s, code } : s)
    };
    commitChanges(newDoc, "heal shape");
  }, [source, commitChanges]);

  const useDataFetch = React.useCallback((url: string) => {
    const [data, setData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<any>(null);
    React.useEffect(() => {
      fetch(url)
        .then(res => res.json())
        .then(data => { setData(data); setLoading(false); })
        .catch(err => { setError(err); setLoading(false); });
    }, [url]);
    return { data, loading, error };
  }, []);

  const useSharedState = React.useCallback((key: string, initialValue: any) => {
    const [val, setVal] = React.useState(() => {
      if (!yjsStoreRef.current) return initialValue;
      const raw = yjsStoreRef.current.getDoc().getMap("sharedState").get(key);
      if (raw !== undefined) {
        try { return JSON.parse(raw as string); } catch { return raw; }
      }
      return initialValue;
    });

    React.useEffect(() => {
      if (!yjsStoreRef.current) return;
      const map = yjsStoreRef.current.getDoc().getMap("sharedState");
      const obs = () => {
        const raw = map.get(key);
        if (raw !== undefined) {
          try { setVal(JSON.parse(raw as string)); } catch { setVal(raw); }
        }
      };
      map.observe(obs);
      return () => map.unobserve(obs);
    }, [key]);

    const setSharedVal = React.useCallback((newVal: any) => {
      if (!yjsStoreRef.current) return;
      setVal(newVal);
      yjsStoreRef.current.getDoc().getMap("sharedState").set(key, JSON.stringify(newVal));
    }, [key]);

    return [val, setSharedVal];
  }, []);
`;

content = content.replace(
  'const { handleCommandOrControl } = useShortcuts();',
  'const { handleCommandOrControl } = useShortcuts();\n' + hookLogic
);

// 4. Add "ui_node" into the switch case
const uiNodeCase = `
        case "ui_node": {
          const s = shape as any;
          return (
            <Group
              key={s.id}
              id={s.id}
              x={s.x}
              y={s.y}
              draggable={draggable}
              onClick={(e) => handleShapeClick(e, s.id)}
              onDblClick={() => handleShapeDblClick(s.id)}
              onDragStart={() => handleShapeDragStart(s.id, s.x, s.y)}
              onDragMove={(e) => handleShapeDragMove(e, s.id, e.target.x(), e.target.y())}
              onDragEnd={() => handleShapeDragEnd(s.id)}
            >
              <Rect width={s.width} height={s.height} cornerRadius={12} fill="#ffffff" shadowColor="rgba(0,0,0,0.1)" shadowBlur={10} shadowOffset={{x:0, y:4}} listening={false} />
              {s.code ? (
                <Html divProps={{ style: { width: s.width, height: s.height, overflow: "hidden", padding: "16px" } }}>
                  <div style={{ pointerEvents: readOnly ? 'none' : 'auto', width: '100%', height: '100%' }}>
                    <ThemeProvider theme="editorial">
                      <LiveProvider 
                        code={s.code} 
                        scope={{ 
                          React, useState, useEffect, useDataFetch, useSharedState,
                          Form, Slider, Toggle, Select, Card,
                          DataTable, Input, Button, Badge, Tabs,
                          Typography, Icon, BarChart, DonutChart, LineChart
                        }}
                      >
                        <LivePreview />
                        <SelfHealingError shapeId={s.id} code={s.code} onHealShape={onHealShape} />
                      </LiveProvider>
                    </ThemeProvider>
                  </div>
                </Html>
              ) : null}
            </Group>
          );
        }
`;

content = content.replace(
  'case "frame": {',
  uiNodeCase + '\n        case "frame": {'
);

fs.writeFileSync('apps/web/components/diagrams/freeform-renderer.tsx', content, 'utf8');
console.log("Renderer patched successfully.");

const fs = require('fs');
let file = fs.readFileSync('apps/web/components/diagrams/freeform-renderer.tsx', 'utf8');

// 1. Update React-Live imports
file = file.replace(
  'import { LiveProvider, LiveError, LivePreview } from "react-live";',
  'import { LiveProvider, LiveError, LivePreview, LiveContext } from "react-live";'
);

// 2. Add Form components imports
file = file.replace(
  'import { Tabs } from "@/components/canvas-ui/Tabs";',
  `import { Tabs } from "@/components/canvas-ui/Tabs";
import { Form } from "@/components/canvas-ui/Form";
import { Slider } from "@/components/canvas-ui/Slider";
import { Toggle } from "@/components/canvas-ui/Toggle";
import { Select } from "@/components/canvas-ui/Select";`
);

// 3. Add SelfHealingError component
const selfHealingErrorComponent = `
function SelfHealingError({ shapeId, code, onHeal }: { shapeId: string, code: string, onHeal: (newCode: string) => void }) {
  const context = React.useContext(LiveContext);
  const error = context?.error;
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!error) {
      attemptRef.current = 0;
      return;
    }
    if (attemptRef.current > 2) return;

    const timer = setTimeout(() => {
      attemptRef.current += 1;
      fetch("/api/ai/repair-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, error: error.toString() })
      })
      .then(res => res.json())
      .then(data => {
        if (data.code && data.code !== code) onHeal(data.code);
      })
      .catch(console.error);
    }, 2000);
    return () => clearTimeout(timer);
  }, [error, code, onHeal]);

  return <LiveError style={{ color: "red", padding: 8, background: "#fee2e2", borderRadius: 4, position: "absolute", bottom: 0, left: 0, right: 0 }} />;
}
`;

file = file.replace(
  'type MacroShapeNodeProps = {',
  selfHealingErrorComponent + '\n\ntype MacroShapeNodeProps = {'
);

// 4. Inject hooks inside FreeformRenderer
const hooksInjection = `
  const useDataFetch = useCallback(function (url: string) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      if (!url) return;
      let cancelled = false;
      setLoading(true);
      fetch(url)
        .then(res => res.json())
        .then(json => {
          if (!cancelled) {
            setData(json);
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            setError(err);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }, [url]);

    return { data, loading, error };
  }, []);

  const useSharedState = useCallback(function <T,>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(initialValue);

    useEffect(() => {
      const store = yjsStoreRef.current;
      if (!store) return;
      const sharedMap = store.ydoc.getMap('sharedState');
      
      const observer = () => {
        if (sharedMap.has(key)) {
          setState(sharedMap.get(key) as T);
        }
      };

      if (sharedMap.has(key)) {
        setState(sharedMap.get(key) as T);
      } else if (initialValue !== undefined) {
        sharedMap.set(key, initialValue);
      }

      sharedMap.observe(observer);
      return () => { sharedMap.unobserve(observer); };
    }, [key]);

    const setSharedState = useCallback((val: T | ((prev: T) => T)) => {
      const store = yjsStoreRef.current;
      if (!store) {
        setState(val);
        return;
      }
      const sharedMap = store.ydoc.getMap('sharedState');
      
      if (typeof val === 'function') {
        setState(prev => {
          const next = (val as any)(prev);
          sharedMap.set(key, next);
          return next;
        });
      } else {
        setState(val);
        sharedMap.set(key, val);
      }
    }, [key]);

    return [state, setSharedState];
  }, []);
`;

file = file.replace(
  'const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(2);',
  'const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(2);\n' + hooksInjection
);

// 5. Update LiveProvider block
const liveProviderSearch = `<LiveProvider 
                code={(shape as UINodeShape).code}
                scope={{ 
                  React,
                  useState: React.useState,
                  useEffect: React.useEffect,
                  useMemo: React.useMemo,
                  useCallback: React.useCallback,
                  motion,
                  AnimatePresence,
                  ThemeProvider, Card, Button, Badge, Typography, Icon, Input, Tabs, DataTable,
                  BarChart, LineChart, DonutChart 
                }}
              >
                <div style={{ height: "100%", width: "100%" }}>
                  <LivePreview style={{ height: "100%", width: "100%" }} />
                  <LiveError style={{ color: "red", padding: 8, background: "#fee2e2", borderRadius: 4, position: "absolute", bottom: 0, left: 0, right: 0 }} />
                </div>
              </LiveProvider>`;

const liveProviderReplace = `<LiveProvider 
                code={(shape as UINodeShape).code}
                scope={{ 
                  React,
                  useState: React.useState,
                  useEffect: React.useEffect,
                  useMemo: React.useMemo,
                  useCallback: React.useCallback,
                  useDataFetch,
                  useSharedState,
                  motion,
                  AnimatePresence,
                  ThemeProvider, Card, Button, Badge, Typography, Icon, Input, Tabs, DataTable,
                  Form, Slider, Toggle, Select,
                  BarChart, LineChart, DonutChart 
                }}
              >
                <div style={{ height: "100%", width: "100%" }}>
                  <LivePreview style={{ height: "100%", width: "100%" }} />
                  <SelfHealingError 
                    shapeId={shape.id} 
                    code={(shape as UINodeShape).code} 
                    onHeal={(newCode) => {
                      const newShapes = docRef.current.shapes.map(s => 
                        s.id === shape.id ? { ...s, code: newCode } : s
                      );
                      commitChanges({ ...docRef.current, shapes: newShapes });
                    }} 
                  />
                </div>
              </LiveProvider>`;

file = file.replace(liveProviderSearch, liveProviderReplace);

fs.writeFileSync('apps/web/components/diagrams/freeform-renderer.tsx', file, 'utf8');
console.log("Renderer patched successfully");

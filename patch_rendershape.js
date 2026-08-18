const fs = require('fs');
let content = fs.readFileSync('apps/web/components/diagrams/freeform-renderer.tsx', 'utf8');

// 1. Update renderShape signature
content = content.replace(
  'connectorLabelLayout?: Map<string, { x: number; y: number }>',
  'connectorLabelLayout?: Map<string, { x: number; y: number }>,\n  onHealShape?: (shapeId: string, newCode: string) => void'
);

// 2. Fix docRef.current / commitChanges inside shapeNode
content = content.replace(
  'const newShapes = docRef.current.shapes.map(s =>',
  'if (onHealShape) onHealShape(shape.id, newCode); //'
);

// 3. Fix SelfHealingError onHeal call
content = content.replace(
  `                    onHeal={(newCode) => {
                      if (onHealShape) onHealShape(shape.id, newCode); // 
                        s.id === shape.id ? { ...s, code: newCode } : s
                      );
                      commitChanges({ ...docRef.current, shapes: newShapes });
                    }} `,
  `                    onHeal={(newCode) => {
                      if (onHealShape) onHealShape(shape.id, newCode);
                    }} `
);

// We need to carefully replace the old onHeal call. Let's do it robustly:
content = content.replace(
  /<SelfHealingError[\s\S]*?onHeal=\{\(newCode\) => \{[\s\S]*?\}\} \/>/m,
  '<SelfHealingError shapeId={shape.id} code={(shape as UINodeShape).code} onHeal={(newCode) => { if (onHealShape) onHealShape(shape.id, newCode); }} />'
);

// 4. Update the call to renderShape inside FreeformRenderer
content = content.replace(
  'connectorLabelLayout',
  'connectorLabelLayout,\n              (shapeId, newCode) => {\n                const newShapes = docRef.current.shapes.map(s => s.id === shapeId ? { ...s, code: newCode } : s);\n                commitChanges({ ...docRef.current, shapes: newShapes });\n              }'
);

fs.writeFileSync('apps/web/components/diagrams/freeform-renderer.tsx', content, 'utf8');
console.log("Patched renderShape");

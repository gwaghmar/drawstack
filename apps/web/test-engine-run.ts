import { applyCanvasOps } from "./lib/diagrams/freeform-ops";
import { CanvasDocument } from "./lib/diagrams/freeform-canvas";

const emptyDoc: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: []
};

const ops = [
  // Add a UI Dashboard Frame
  { op: "add", shape: { id: "dashboard", type: "frame", name: "Main Dashboard", x: 0, y: 0, width: 800, height: 600 } },
  
  // Add a Sidebar
  { op: "add", shape: { id: "sidebar", type: "rectangle", name: "Sidebar UI", x: 0, y: 0, width: 200, height: 600, fill: "2" } },
  
  // Try to put the sidebar inside the dashboard using relative placement
  { op: "place", target: "sidebar", inside: "dashboard", align: "left" },

  // Add some text that might spill out if we don't calculate width
  { op: "add", shape: { id: "headerText", type: "text", text: { content: "Welcome to the Super Complex AI Dashboard that has way too much text to fit in a small box", fontSize: 24 } } },
  { op: "place", target: "headerText", inside: "dashboard", align: "top", gap: 20 }
];

const result = applyCanvasOps(emptyDoc, ops as any);

console.log("=== ENGINE TEST RESULT ===");
console.log(JSON.stringify(result, null, 2));

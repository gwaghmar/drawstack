import fs from "fs";
import path from "path";
import { freeformToSvg } from "../lib/diagrams/freeform-svg";
import { CanvasDocument } from "../lib/diagrams/freeform-canvas";

const outputDir = path.join(__dirname, "../../../.gemini/antigravity/brain/7cb2b6fa-3312-4321-a25d-6ede85631a3c/test_suite");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Venn Timeline
const vennDoc: CanvasDocument = {
  version: 1,
  shapes: [
    {
      id: "vt1",
      type: "venn_timeline",
      x: 100,
      y: 100,
      width: 400,
      height: 600,
      title: "Graphic Design Concept",
      nodes: [
        { primaryText: "Idea", subText: "Brainstorming", number: "01", vennLabels: ["Form", "Function"], branches: [{ text: "Typography", side: "left" }] },
        { primaryText: "Draft", subText: "Initial Sketches", number: "02", color: "accent", branches: [{ text: "Color", side: "right" }] },
        { primaryText: "Final", subText: "Delivery", number: "03", color: "dark" }
      ]
    }
  ]
};

// 2. Tech HUD Panel
const hudDoc: CanvasDocument = {
  version: 1,
  shapes: [
    {
      id: "hud1",
      type: "tech_hud_panel",
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      title: "System Diagnostics",
      gridItems: [
        { label: "Sector Alpha", value: "12415251", barcode: true, colSpan: 2 },
        { label: "Target", crosshair: true, rowSpan: 2 },
        { label: "Status", value: "ONLINE" },
        { label: "Temp", value: "34C", colSpan: 2 }
      ]
    }
  ]
};

// 3. Layered Process Map
const mapDoc: CanvasDocument = {
  version: 1,
  shapes: [
    {
      id: "map1",
      type: "layered_process_map",
      x: 100,
      y: 100,
      width: 600,
      height: 800,
      title: "Gastronomy Process",
      zones: [
        { id: "z1", label: "Mental & Emotional", color: "#eab308" },
        { id: "z2", label: "Physical Process", color: "#3b82f6" }
      ],
      nodes: [
        { id: "n1", zoneId: "z1", label: "Actors", icon: "people" },
        { id: "n2", zoneId: "z2", label: "Elaboration", icon: "circle" },
        { id: "n3", zoneId: "z2", label: "Delivery", icon: "circle" }
      ],
      connections: [
        { from: "n1", to: "n2", style: "solid", color: "#3b82f6" },
        { from: "n2", to: "n3", style: "dotted", color: "#eab308" }
      ]
    }
  ]
};

const renderAndSave = (name: string, doc: CanvasDocument) => {
  const svg = freeformToSvg(doc, { theme: "light" });
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), svg);
  console.log(`Saved ${name}.svg`);
};

renderAndSave("test_11_venn_timeline", vennDoc);
renderAndSave("test_12_tech_hud", hudDoc);
renderAndSave("test_13_process_map", mapDoc);

console.log("Done.");

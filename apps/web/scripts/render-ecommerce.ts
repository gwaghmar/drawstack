import fs from "node:fs";
import path from "node:path";
import { freeformToSvg } from "../lib/diagrams/freeform-svg.ts";
import type { CanvasDocument } from "../lib/diagrams/freeform-canvas.ts";

const ARTIFACT_DIR = "/Users/redforman/.gemini/antigravity/brain/7cb2b6fa-3312-4321-a25d-6ede85631a3c";

export function renderAndSave(doc: CanvasDocument, filename: string): string {
  const svg = freeformToSvg(doc);
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, svg, "utf-8");
  return outPath;
}

const ECOMMERCE_FLOW: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "shopper",
      type: "ellipse",
      x: 50,
      y: 180,
      width: 140,
      height: 75,
      fill: "5",
      stroke: "#2563eb",
      strokeWidth: 2,
      text: { content: "Mobile Shopper", bold: true, fontSize: 13 },
    },
    {
      id: "cdn",
      type: "cloud",
      x: 250,
      y: 165,
      width: 160,
      height: 100,
      fill: "1",
      stroke: "#0284c7",
      strokeWidth: 2,
      text: { content: "Edge CDN & WAF", bold: true, fontSize: 13 },
    },
    {
      id: "inventory_check",
      type: "diamond",
      x: 480,
      y: 155,
      width: 170,
      height: 120,
      fill: "3",
      stroke: "#d97706",
      strokeWidth: 2,
      text: { content: "Item in Stock?", bold: true, fontSize: 12 },
    },
    {
      id: "order_queue",
      type: "hexagon",
      x: 720,
      y: 80,
      width: 160,
      height: 95,
      fill: "6",
      stroke: "#7c3aed",
      strokeWidth: 2,
      text: { content: "Kafka Order Stream", bold: true, fontSize: 12 },
    },
    {
      id: "out_of_stock",
      type: "rectangle",
      x: 720,
      y: 280,
      width: 160,
      height: 75,
      fill: "2",
      stroke: "#dc2626",
      strokeWidth: 2,
      text: { content: "Notify Waitlist", bold: true, fontSize: 12 },
    },
    {
      id: "db_orders",
      type: "cylinder",
      x: 950,
      y: 70,
      width: 150,
      height: 110,
      fill: "4",
      stroke: "#16a34a",
      strokeWidth: 2,
      text: { content: "Orders Cluster\n(PostgreSQL)", bold: true, fontSize: 12 },
    },
    {
      id: "stripe_payment",
      type: "cloud",
      x: 950,
      y: 260,
      width: 160,
      height: 105,
      fill: "2",
      stroke: "#e11d48",
      strokeWidth: 2,
      text: { content: "Stripe Gateway", bold: true, fontSize: 12 },
    },
    // Connectors
    {
      id: "a1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "shopper", anchor: "right" },
      end: { shapeId: "cdn", anchor: "left" },
      label: "Checkout Request",
    },
    {
      id: "a2",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "cdn", anchor: "right" },
      end: { shapeId: "inventory_check", anchor: "left" },
      label: "Validate",
    },
    {
      id: "a3",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "inventory_check", anchor: "top" },
      end: { shapeId: "order_queue", anchor: "left" },
      routing: "orthogonal",
      label: "In Stock (Yes)",
    },
    {
      id: "a4",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "inventory_check", anchor: "bottom" },
      end: { shapeId: "out_of_stock", anchor: "left" },
      routing: "orthogonal",
      label: "Out of Stock (No)",
    },
    {
      id: "a5",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "order_queue", anchor: "right" },
      end: { shapeId: "db_orders", anchor: "left" },
      label: "Commit Tx",
    },
    {
      id: "a6",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "order_queue", anchor: "bottom" },
      end: { shapeId: "stripe_payment", anchor: "left" },
      routing: "orthogonal",
      label: "Execute Charge",
    },
  ],
};

renderAndSave(ECOMMERCE_FLOW, "ecommerce_live_architecture.svg");
console.log("Rendered ecommerce_live_architecture.svg");

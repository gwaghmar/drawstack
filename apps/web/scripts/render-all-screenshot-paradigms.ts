import fs from "node:fs";
import path from "node:path";
import { freeformToSvg } from "../lib/diagrams/freeform-svg.ts";
import type { CanvasDocument } from "../lib/diagrams/freeform-canvas.ts";

const ARTIFACT_DIR = "/Users/redforman/.gemini/antigravity/brain/7cb2b6fa-3312-4321-a25d-6ede85631a3c";

// ─────────────────────────────────────────────────────────────────────────────
// 1. APPLE EXECUTIVE FINANCIAL SUMMARY DASHBOARD (Screenshots 1 & 2)
// ─────────────────────────────────────────────────────────────────────────────
const APPLE_DASHBOARD_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    // Top Dashboard Navigation Shell & Highlight Callout
    {
      id: "apple_nav",
      type: "dashboard",
      title: "Apple Dashboard",
      subtitle: "Financial Summary · FY26 · 3 quarters (9mo)  all figures as reported",
      badge: "Total assets $383.3B",
      tabs: [
        { label: "Home" },
        { label: "Exec Summary", active: true },
        { label: "Revenue" },
        { label: "Profitability" },
        { label: "Balance Sheet" },
      ],
      actions: [
        { label: "Filters" },
        { label: "Download CSV" },
        { label: "Ask AI" },
        { label: "Dark" },
      ],
      highlightBanner: {
        text: "FY26 · 3 quarters (9mo) net sales grew +16.2% YoY to $364.4B at 49.1% gross margin. Q4 guidance points to 9% to 11% revenue growth.",
        variant: "coral",
      },
      x: 30,
      y: 30,
      width: 1360,
      height: 780,
    },

    // Card 1: Revenue by Quarter Grouped Bars with Estimation
    {
      id: "revenue_quarterly",
      type: "chart",
      parentId: "apple_nav",
      title: "ANALYTICS · REVENUE BY QUARTER",
      subtitle: "$364.4B  +16.2% YoY • Products $272.6B · Services $91.7B",
      chartType: "grouped_bar",
      groupedData: [
        {
          category: "Q1 FY26",
          series: [{ name: "Revenue", value: 143.8, color: "#3b82f6", formatted: "$143.8B" }],
        },
        {
          category: "Q2 FY26",
          series: [{ name: "Revenue", value: 111.2, color: "#3b82f6", formatted: "$111.2B" }],
        },
        {
          category: "Q3 FY26",
          series: [{ name: "Revenue", value: 109.4, color: "#3b82f6", formatted: "$109.4B" }],
        },
        {
          category: "Q4 FY26E",
          series: [{ name: "Estimated", value: 112.7, color: "#f59e0b", formatted: "$112.7B", isEstimate: true }],
        },
      ],
      x: 50,
      y: 170,
      width: 440,
      height: 380,
    },

    // Card 2: Total Spending Breakdown Bars
    {
      id: "spending_breakdown",
      type: "chart",
      parentId: "apple_nav",
      title: "TOTAL SPENDING · FY26 · 3 QUARTERS (9MO)",
      subtitle: "$241.9B  +13.5% YoY • Cost of sales $185.6B · R&D $34.0B · SG&A $22.3B",
      chartType: "grouped_bar",
      groupedData: [
        {
          category: "Cost of sales",
          series: [{ name: "COGS", value: 185.6, color: "#ea580c", formatted: "$185.6B" }],
        },
        {
          category: "R&D",
          series: [{ name: "R&D", value: 34.0, color: "#3b82f6", formatted: "$34.0B" }],
        },
        {
          category: "SG&A",
          series: [{ name: "SG&A", value: 22.3, color: "#64748b", formatted: "$22.3B" }],
        },
      ],
      x: 510,
      y: 170,
      width: 400,
      height: 380,
    },

    // Card 3: Recent Activity & Real Filing Events Table
    {
      id: "recent_filing_events",
      type: "feed_table",
      parentId: "apple_nav",
      title: "Recent Activity · Real Filing Events",
      subtitle: "SEC 10-Q Disclosures & Authorized Transactions",
      rows: [
        { date: "Jul 30 '26", event: "Q4 guide: revenue +9-11%, GM ~46.5%", amount: "FX -2.5pt", amountColor: "#ef4444" },
        { date: "Q3 FY26", event: "Common stock repurchased", amount: "$25.8B", amountColor: "#0f172a" },
        { date: "Q3 FY26", event: "Dividend declared per share", amount: "$0.27", amountColor: "#0f172a" },
        { date: "Apr 30 '26", event: "New buyback program announced", amount: "$100.0B", amountColor: "#10b981" },
        { date: "Apr 20 '26", event: "John Ternus named CEO, eff. Sep 1", amount: "—", amountColor: "#64748b" },
        { date: "9mo FY26", event: "Shares repurchased", amount: "215M", amountColor: "#0f172a" },
      ],
      x: 930,
      y: 170,
      width: 440,
      height: 270,
    },

    // Card 4: Net Income Progress Gauges
    {
      id: "net_income_gauges",
      type: "chart",
      parentId: "apple_nav",
      title: "INCOME / NET INCOME · FY26 · 3 QUARTERS (9MO)",
      subtitle: "$101.5B  +20.0% YoY • Diluted EPS $6.88 · Operating margin 33.6%",
      chartType: "progress_gauge",
      progressSegments: [
        { label: "Operating cash flow · FY26 · 3 quarters (9mo)", value: "$117.0B", percent: 85, color: "#3b82f6" },
        { label: "Free cash flow · FY26 · 3 quarters (9mo) (opCF - capex)", value: "$110.2B", percent: 78, color: "#10b981" },
      ],
      x: 510,
      y: 570,
      width: 400,
      height: 190,
    },

    // Card 5: Balance Sheet & Buyback Authorization
    {
      id: "balance_sheet_gauges",
      type: "chart",
      parentId: "apple_nav",
      title: "BALANCE SHEET / BUYBACK AUTHORIZATION",
      subtitle: "Cash + marketable securities $146.5B · Term debt $82.3B",
      chartType: "progress_gauge",
      progressSegments: [
        { label: "May 2025 program · 62% used", value: "$38.0B left", percent: 62, color: "#f97316" },
        { label: "Apr 2026 program · announced", value: "$100.0B", percent: 15, color: "#94a3b8" },
        { label: "Shareholders' equity", value: "$107.5B", percent: 55, color: "#6366f1" },
      ],
      x: 930,
      y: 460,
      width: 440,
      height: 300,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SWISS EDITORIAL CONCEPT MINDMAP & FISHBONE (Screenshot 3)
// ─────────────────────────────────────────────────────────────────────────────
const SWISS_MINDMAP_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "swiss_mindmap",
      type: "mindmap",
      title: "Graphic Design Concept Mindmap",
      x: 50,
      y: 40,
      width: 540,
      height: 960,
      steps: [
        {
          number: "01",
          title: "Graphic design",
          subtitle: "concept",
          isTerminal: true,
        },
        {
          number: "02",
          title: "Branches",
          branches: [
            { side: "left", text: "font" },
            { side: "right", text: "color" },
            { side: "left", text: "shape" },
            { side: "right", text: "size" },
            { side: "left", text: "print" },
            { side: "right", text: "illustration" },
            { side: "right", text: "etc." },
          ],
        },
        {
          number: "03",
          title: "Venn Intersections",
          vennNodes: [
            { label: "visual\nfunction", callout: "What is the target of this design?\nWhat emotional functions will you feel?" },
            { label: "visual\nmood", callout: "Keywords that can be derived" },
          ],
        },
        {
          number: "04",
          title: "concept 01",
          isTerminal: true,
        },
        {
          number: "05",
          title: "Process Pills",
          pills: ["idea sketch", "idea meeting", "turn on adobe software"],
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. EDITORIAL SERPENTINE S-CURVE TIMELINE (Screenshot 4)
// ─────────────────────────────────────────────────────────────────────────────
const SCURVE_TIMELINE_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "scurve_infographic",
      type: "scurve_timeline",
      title: "Project Steps",
      subtitle: "INFOGRAPHICS TEMPLATE",
      strokeColor: "#365f60",
      x: 40,
      y: 40,
      width: 720,
      height: 960,
      hasSilhouette: true,
      steps: [
        {
          stepNumber: "01",
          title: "Research & Discovery",
          description: "Establish project scope, user personas, and stakeholder alignment.\nSynthesize competitive market dynamics.",
          hubColor: "#cf3c2e",
        },
        {
          stepNumber: "02",
          title: "Architectural Design",
          description: "Define core declarative scene graph primitives, geometry engines,\nand vector rendering pipelines.",
          hubColor: "#cf3c2e",
        },
        {
          stepNumber: "03",
          title: "Prototyping & AI Agents",
          description: "Deploy autonomous subagents for multimodal generative layout\nand real-time validation feedback loops.",
          hubColor: "#cf3c2e",
        },
        {
          stepNumber: "04",
          title: "Production Launch",
          description: "Execute global CDN deployment with zero-latency telemetry,\ninstant export, and high-fidelity WYSIWYG rendering.",
          hubColor: "#cf3c2e",
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. 3D ISOMETRIC ARCHITECTURAL GEOMETRY (Screenshot 5)
// ─────────────────────────────────────────────────────────────────────────────
const ISOMETRIC_BLOCK_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "iso_infographic",
      type: "isometric_block",
      title: "Business Growth",
      subtitle: "INFOGRAPHICS TEMPLATE",
      baseColor: "#d1382b",
      x: 40,
      y: 40,
      width: 800,
      height: 720,
      hasSilhouette: true,
      callouts: [
        {
          number: "01",
          title: "Foundation & Setup",
          description: "Establish scalable modular architecture and foundational database design.\nImplement robust CI/CD and telemetry.",
          side: "left",
        },
        {
          number: "02",
          title: "Ecosystem Expansion",
          description: "Integrate multi-provider AI agents, cloud orchestration, and automated billing.\nAccelerate velocity with high test coverage.",
          side: "right",
        },
        {
          number: "03",
          title: "Market Leadership",
          description: "Achieve world-class UI fidelity exceeding Figma, Miro, and Canva.\nDeliver real-time multiplayer collaboration.",
          side: "right",
        },
      ],
    },
  ],
};

// ─── Render All 4 High-Resolution SVGs ───────────────────────────────────────
// 1. Apple Dashboard (Light & Dark)
fs.writeFileSync(path.join(ARTIFACT_DIR, "apple_financial_dashboard.svg"), freeformToSvg(APPLE_DASHBOARD_DOC, { theme: "light" }));
fs.writeFileSync(path.join(ARTIFACT_DIR, "apple_financial_dashboard_dark.svg"), freeformToSvg(APPLE_DASHBOARD_DOC, { theme: "dark" }));

// 2. Swiss Concept Mindmap
fs.writeFileSync(path.join(ARTIFACT_DIR, "swiss_concept_mindmap.svg"), freeformToSvg(SWISS_MINDMAP_DOC, { theme: "light" }));

// 3. Editorial Serpentine S-Curve Timeline
fs.writeFileSync(path.join(ARTIFACT_DIR, "editorial_scurve_timeline.svg"), freeformToSvg(SCURVE_TIMELINE_DOC, { theme: "editorial" }));

// 4. 3D Isometric Geometry Infographic
fs.writeFileSync(path.join(ARTIFACT_DIR, "isometric_business_growth.svg"), freeformToSvg(ISOMETRIC_BLOCK_DOC, { theme: "editorial" }));

console.log("Successfully rendered all 4 reference screenshot paradigms to:", ARTIFACT_DIR);

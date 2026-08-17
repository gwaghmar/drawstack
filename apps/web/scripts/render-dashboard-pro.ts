import fs from "node:fs";
import path from "node:path";
import { freeformToSvg } from "../lib/diagrams/freeform-svg.ts";
import type { CanvasDocument } from "../lib/diagrams/freeform-canvas.ts";

const ARTIFACT_DIR = "/Users/redforman/.gemini/antigravity/brain/7cb2b6fa-3312-4321-a25d-6ede85631a3c";

const PRO_DASHBOARD_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    // ─── Outer MacBook Window Frame ───────────────────────────────────────────
    {
      id: "macbook_window",
      type: "mockup",
      mockupType: "browser",
      title: "Drawstack AI Studio — Executive Cloud & Agent Ops",
      url: "https://app.drawstack.io/analytics/live",
      x: 30,
      y: 30,
      width: 1340,
      height: 740,
      stroke: "#334155",
      strokeWidth: 1.5,
      cornerRadius: 14,
    },

    // ─── Row 1: KPI Metric Cards with Delta & Sparklines ──────────────────────
    {
      id: "mrr_kpi",
      type: "metric",
      parentId: "macbook_window",
      label: "Annual Run Rate (ARR)",
      value: "$4,280,500",
      delta: "+28.4% YoY",
      deltaDirection: "up",
      sparkline: [20, 24, 28, 35, 32, 45, 52, 68],
      icon: "activity",
      stroke: "#6366f1",
      x: 60,
      y: 95,
      width: 290,
      height: 115,
    },
    {
      id: "tokens_kpi",
      type: "metric",
      parentId: "macbook_window",
      label: "Agent Tokens / Sec",
      value: "84,920 tps",
      delta: "+42.1% WoW",
      deltaDirection: "up",
      sparkline: [40, 48, 55, 62, 70, 78, 85, 92],
      icon: "cpu",
      stroke: "#10a37f",
      x: 380,
      y: 95,
      width: 290,
      height: 115,
    },
    {
      id: "latency_kpi",
      type: "metric",
      parentId: "macbook_window",
      label: "p99 apply_ops Latency",
      value: "1.42 ms",
      delta: "-18.5% faster",
      deltaDirection: "up",
      sparkline: [60, 52, 45, 38, 30, 22, 18, 14],
      icon: "activity",
      stroke: "#0284c7",
      x: 700,
      y: 95,
      width: 290,
      height: 115,
    },
    {
      id: "uptime_kpi",
      type: "metric",
      parentId: "macbook_window",
      label: "Global Uptime SLA",
      value: "99.999%",
      delta: "100% Target",
      deltaDirection: "up",
      sparkline: [99, 99.5, 99.8, 99.9, 99.99, 100, 100, 100],
      icon: "shield",
      stroke: "#16a34a",
      x: 1020,
      y: 95,
      width: 310,
      height: 115,
    },

    // ─── Row 2: Vector Charts (Area + Bar) ───────────────────────────────────
    {
      id: "throughput_area_chart",
      type: "chart",
      parentId: "macbook_window",
      title: "Real-Time AI Generation Volume & Ops Stream",
      subtitle: "Hourly aggregated request throughput (req/min)",
      chartType: "area",
      stroke: "#6366f1",
      data: [
        { label: "00:00", value: 120 },
        { label: "04:00", value: 85 },
        { label: "08:00", value: 340 },
        { label: "12:00", value: 580 },
        { label: "16:00", value: 820 },
        { label: "20:00", value: 690 },
        { label: "23:59", value: 410 },
      ],
      x: 60,
      y: 235,
      width: 730,
      height: 255,
    },
    {
      id: "cost_bar_chart",
      type: "chart",
      parentId: "macbook_window",
      title: "Model Cost vs Speed ($ / 1M tokens)",
      subtitle: "Benchmark efficiency across providers",
      chartType: "bar",
      stroke: "#0284c7",
      data: [
        { label: "Gemini Flash", value: 10, color: "#10b981" },
        { label: "GPT-4o mini", value: 15, color: "#0284c7" },
        { label: "Haiku 3.5", value: 25, color: "#f59e0b" },
        { label: "Claude Sonnet", value: 80, color: "#7c3aed" },
        { label: "GPT-4o", value: 95, color: "#ef4444" },
      ],
      x: 820,
      y: 235,
      width: 510,
      height: 255,
    },

    // ─── Row 3: Active Architecture Microservice & Live Database Table ────────
    {
      id: "agent_service_card",
      type: "card",
      parentId: "macbook_window",
      icon: "openai",
      stroke: "#10a37f",
      badge: { text: "AUTONOMOUS", bg: "#022c22", color: "#34d399" },
      title: "Agent Ops Gateway Cluster",
      subtitle: "Vercel AI SDK v6 • Multi-Model Subagent Pipeline",
      metadata: [
        { label: "Active Workers", value: "48 Edge Sandboxes" },
        { label: "Memory Footprint", value: "42MB per instance" },
      ],
      x: 60,
      y: 515,
      width: 400,
      height: 145,
    },
    {
      id: "live_db_table",
      type: "table",
      parentId: "macbook_window",
      tableName: "live_agent_executions",
      stroke: "#0284c7",
      headerBg: "#0c4a6e",
      columns: [
        { name: "task_id", type: "uuid", isPk: true },
        { name: "model_id", type: "varchar(64)" },
        { name: "tokens_used", type: "int4" },
        { name: "cost_usd", type: "numeric(8,6)" },
        { name: "status", type: "varchar(16)" },
      ],
      x: 500,
      y: 515,
      width: 440,
      height: 175,
    },
    {
      id: "stripe_settlement_card",
      type: "card",
      parentId: "macbook_window",
      icon: "stripe",
      stroke: "#635bff",
      badge: { text: "PRO REVENUE", bg: "#1e1b4b", color: "#818cf8" },
      title: "Real-Time Stripe Invoicing",
      subtitle: "Instant Settlement & Credit Top-ups",
      metadata: [
        { label: "Success Rate", value: "99.98%" },
        { label: "Webhooks", value: "240 events/sec" },
      ],
      x: 980,
      y: 515,
      width: 350,
      height: 145,
    },

    // ─── Smooth Connectors with Obstacle Clearance ───────────────────────────
    {
      id: "a1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "agent_service_card", anchor: "right" },
      end: { shapeId: "live_db_table", anchor: "left" },
      routing: "orthogonal",
      label: "Log Telemetry",
    },
    {
      id: "a2",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "live_db_table", anchor: "right" },
      end: { shapeId: "stripe_settlement_card", anchor: "left" },
      routing: "orthogonal",
      label: "Debit Credits",
    },
  ],
};

// 1. Render Dark Obsidian & Neon Cyber Theme
const svgDark = freeformToSvg(PRO_DASHBOARD_DOC, { theme: "dark" });
const outDark = path.join(ARTIFACT_DIR, "dashboard_dark_obsidian.svg");
fs.writeFileSync(outDark, svgDark, "utf-8");
console.log("Rendered Dark Obsidian Dashboard to:", outDark);

// 2. Render High-Contrast Light Theme
const svgLight = freeformToSvg(PRO_DASHBOARD_DOC, { theme: "light" });
const outLight = path.join(ARTIFACT_DIR, "dashboard_high_contrast_light.svg");
fs.writeFileSync(outLight, svgLight, "utf-8");
console.log("Rendered High-Contrast Light Dashboard to:", outLight);

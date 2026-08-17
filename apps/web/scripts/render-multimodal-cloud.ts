import fs from "node:fs";
import path from "node:path";
import { freeformToSvg } from "../lib/diagrams/freeform-svg.ts";
import type { CanvasDocument } from "../lib/diagrams/freeform-canvas.ts";

const ARTIFACT_DIR = "/Users/redforman/.gemini/antigravity/brain/7cb2b6fa-3312-4321-a25d-6ede85631a3c";
const IMG_PATH = path.join(ARTIFACT_DIR, "ai_system_core_1786941582833.jpg");

const imgBase64 = fs.existsSync(IMG_PATH)
  ? `data:image/jpeg;base64,${fs.readFileSync(IMG_PATH).toString("base64")}`
  : "";

const AI_CLOUD_DOC: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    // ─── Domain Frames ────────────────────────────────────────────────────────
    { id: "f_edge", type: "frame", name: "1. Edge Ingress & Client Layer", x: 40, y: 40, width: 380, height: 560, fill: "transparent" },
    { id: "f_ai", type: "frame", name: "2. Autonomous AI Neural Core & Agent Engine", x: 450, y: 40, width: 500, height: 560, fill: "transparent" },
    { id: "f_data", type: "frame", name: "3. Distributed Storage, Mesh & Payments", x: 980, y: 40, width: 440, height: 560, fill: "transparent" },

    // ─── Layer 1: Edge & Client ───────────────────────────────────────────────
    {
      id: "nextjs_client",
      type: "card",
      parentId: "f_edge",
      x: 65,
      y: 90,
      width: 330,
      height: 125,
      icon: "nextjs",
      stroke: "#0f172a",
      badge: { text: "SSR & REACT 19", bg: "#f1f5f9", color: "#0f172a" },
      title: "Web & Mobile Studio",
      subtitle: "Turbopack • Tailwind • Canvas Stage",
      metadata: [
        { label: "Rendering", value: "60 FPS Interactive Konva" },
        { label: "Auth Scope", value: "Supabase JWT + Passkeys" },
      ],
    },
    {
      id: "k8s_gateway",
      type: "card",
      parentId: "f_edge",
      x: 65,
      y: 240,
      width: 330,
      height: 125,
      icon: "k8s",
      stroke: "#326ce5",
      badge: { text: "INGRESS", bg: "#eff6ff", color: "#1d4ed8" },
      title: "Kubernetes Envoy Gateway",
      subtitle: "mTLS • Cloudflare DDoS Shield",
      metadata: [
        { label: "Throughput", value: "500,000 req/sec" },
        { label: "Latency p99", value: "< 1.8ms" },
      ],
    },
    {
      id: "graphql_router",
      type: "card",
      parentId: "f_edge",
      x: 65,
      y: 390,
      width: 330,
      height: 125,
      icon: "graphql",
      stroke: "#e10098",
      badge: { text: "FEDERATION", bg: "#fdf2f8", color: "#be185d" },
      title: "GraphQL Subgraph Router",
      subtitle: "Apollo Federation • Schema Registry",
      metadata: [
        { label: "Introspection", value: "Strict Type Safety" },
        { label: "Caching", value: "Redis Stale-While-Revalidate" },
      ],
    },

    // ─── Layer 2: AI Neural Core (With Real Embedded 3D AI Processor Image) ───
    {
      id: "ai_core_hero",
      type: "image",
      parentId: "f_ai",
      src: imgBase64,
      x: 480,
      y: 90,
      width: 440,
      height: 240,
      stroke: "#6366f1",
      strokeWidth: 2,
      cornerRadius: 12,
    },
    {
      id: "agent_orchestrator",
      type: "card",
      parentId: "f_ai",
      x: 480,
      y: 350,
      width: 440,
      height: 140,
      icon: "openai",
      stroke: "#10a37f",
      badge: { text: "AGENT WORKFLOW", bg: "#ecfdf5", color: "#047857" },
      title: "Autonomous Agent Orchestrator",
      subtitle: "Vercel AI SDK v6 • Multi-Provider Multi-Step Tools",
      metadata: [
        { label: "Models", value: "Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o" },
        { label: "Execution", value: "Surgical AST apply_ops (< 250ms)" },
      ],
    },

    // ─── Layer 3: Storage & Payments ─────────────────────────────────────────
    {
      id: "kafka_stream",
      type: "card",
      parentId: "f_data",
      x: 1010,
      y: 90,
      width: 380,
      height: 120,
      icon: "kafka",
      stroke: "#231f20",
      badge: { text: "EVENT BUS", bg: "#f1f5f9", color: "#334155" },
      title: "Apache Kafka Event Mesh",
      subtitle: "High-throughput Persistent Replay",
      metadata: [
        { label: "Topics", value: "diagram.ops, agent.events, telemetry.v1" },
      ],
    },
    {
      id: "db_postgres",
      type: "table",
      parentId: "f_data",
      x: 1010,
      y: 230,
      width: 380,
      height: 160,
      tableName: "core_canvas_projects",
      stroke: "#336791",
      headerBg: "#e0f2fe",
      columns: [
        { name: "id", type: "uuid", isPk: true },
        { name: "user_id", type: "uuid", isFk: true },
        { name: "diagram_type", type: "varchar(32)" },
        { name: "scene_graph_ast", type: "jsonb" },
        { name: "updated_at", type: "timestamptz" },
      ],
    },
    {
      id: "stripe_billing",
      type: "card",
      parentId: "f_data",
      x: 1010,
      y: 410,
      width: 380,
      height: 125,
      icon: "stripe",
      stroke: "#635bff",
      badge: { text: "BILLING & PRO", bg: "#eef2ff", color: "#4338ca" },
      title: "Stripe Metered Billing",
      subtitle: "Webhooks • Automatic Credits • Subscriptions",
      metadata: [
        { label: "SLA", value: "100% Guaranteed Idempotency" },
        { label: "Security", value: "PCI-DSS Level 1 Compliant" },
      ],
    },

    // ─── Smooth Connectors ───────────────────────────────────────────────────
    {
      id: "a1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "nextjs_client", anchor: "bottom" },
      end: { shapeId: "k8s_gateway", anchor: "top" },
      routing: "orthogonal",
      label: "HTTPS / WSS",
    },
    {
      id: "a2",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "k8s_gateway", anchor: "bottom" },
      end: { shapeId: "graphql_router", anchor: "top" },
      routing: "orthogonal",
      label: "gRPC Dispatch",
    },
    {
      id: "a3",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "graphql_router", anchor: "right" },
      end: { shapeId: "agent_orchestrator", anchor: "left" },
      routing: "orthogonal",
      label: "Prompt & Tools Stream",
    },
    {
      id: "a4",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "ai_core_hero", anchor: "bottom" },
      end: { shapeId: "agent_orchestrator", anchor: "top" },
      routing: "orthogonal",
      label: "Inference Weights & Embeddings",
    },
    {
      id: "a5",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "agent_orchestrator", anchor: "right" },
      end: { shapeId: "kafka_stream", anchor: "left" },
      routing: "orthogonal",
      label: "Emit apply_ops",
    },
    {
      id: "a6",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "agent_orchestrator", anchor: "right" },
      end: { shapeId: "db_postgres", anchor: "left" },
      routing: "orthogonal",
      label: "Persist Document",
    },
    {
      id: "a7",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "agent_orchestrator", anchor: "right" },
      end: { shapeId: "stripe_billing", anchor: "left" },
      routing: "orthogonal",
      label: "Reserve AI Token Credit",
    },
  ],
};

const svg = freeformToSvg(AI_CLOUD_DOC);
const outPath = path.join(ARTIFACT_DIR, "ai_cloud_multimodal_architecture.svg");
fs.writeFileSync(outPath, svg, "utf-8");
console.log("Rendered multimodal AI cloud architecture SVG to:", outPath);

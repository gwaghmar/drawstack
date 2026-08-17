/** Prompt + text diagram starters for FigJam-style pipelines and common flows */
import type { DiagramType } from "./diagram-types.js";

export type FlowchartTemplate = {
  id: string;
  title: string;
  description: string;
  /** Short instruction for LLM / user */
  promptHint: string;
  /** Diagram type for this template — defaults to "mermaid" */
  diagramType?: DiagramType;
  /** Source content for this template */
  source?: string;
  /** @deprecated Use source instead — kept for backwards compatibility */
  mermaid: string;
};

export const TEMPLATES: FlowchartTemplate[] = [
  {
    id: "stage_pipeline_azure_style",
    title: "5-stage technical pipeline",
    description: "Numbered subgraphs, phased colors, edge verbs — FigJam-style",
    promptHint:
      "Use flowchart LR, numbered subgraphs per stage, classDef for phase colors, verbs on edges, dashed line for side notes.",
    mermaid: `flowchart LR
  subgraph s0["Input"]
    A["PDFs, storage, databases"]
  end
  subgraph s1["1. Store & prepare"]
    B["Ingest metadata\\nValidate access"]
  end
  subgraph s2["2. Extract"]
    C["Text, tables, KV pairs"]
  end
  subgraph s3["3. Ground"]
    D["Retrieve context\\nReduce hallucinations"]
  end
  subgraph s4["4. Orchestrate"]
    E["APIs, rules, routing"]
  end
  subgraph s5["5. Trace & publish"]
    F["Observability\\nAudit trail"]
  end
  subgraph out["Outcome"]
    G["Faster processing\\nLess manual review"]
  end
  A -->|ingest| B
  B -->|extract| C
  C -->|ground| D
  D -->|orchestrate| E
  E -->|govern| F
  F -->|ship| G
  classDef phase1 fill:#dbeafe,stroke:#3b82f6,color:#0f172a
  classDef phase2 fill:#cffafe,stroke:#06b6d4,color:#0f172a
  classDef phase3 fill:#ede9fe,stroke:#8b5cf6,color:#0f172a
  classDef phase4 fill:#fef3c7,stroke:#f59e0b,color:#0f172a
  classDef phase0 fill:#f8fafc,stroke:#94a3b8,color:#0f172a
  class A,B phase0
  class B phase1
  class C phase2
  class D phase3
  class E,F phase3
  class G phase4`,
  },
  {
    id: "product_lifecycle_warm",
    title: "Product lifecycle — warm palette",
    description:
      "Discover → try → adopt → expand — coral, amber, mint, and plum (distinct from the cool blue pipeline)",
    promptHint:
      "Use flowchart TD, subgraphs per funnel stage, classDef with warm fills and dark strokes for contrast.",
    mermaid: `flowchart TD
  subgraph discover["Discover"]
    A["Campaigns & SEO"] --> B["Landing + demo"]
  end
  subgraph try["Try"]
    B --> C["Free trial / sandbox"]
    C --> D{Activated?}
  end
  subgraph adopt["Adopt"]
    D -->|Yes| E["Team rollout"]
    D -->|No| F["Nurture sequence"]
    F --> B
  end
  subgraph expand["Expand"]
    E --> G["Upsell + integrations"]
    G --> H["Advocacy / referrals"]
  end
  classDef warmRose fill:#ffe4e6,stroke:#f43f5e,color:#881337
  classDef warmAmber fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef warmMint fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef warmPlum fill:#f3e8ff,stroke:#9333ea,color:#581c87
  classDef warmSand fill:#fafaf9,stroke:#a8a29e,color:#292524
  class A,B warmSand
  class C,D warmAmber
  class E,F warmRose
  class G,H warmMint`,
  },
  {
    id: "distributed_microservices",
    title: "Distributed microservices architecture",
    description:
      "Gateway, auth, async queue, workers, cache, observability and failure paths",
    promptHint:
      "Use flowchart LR, subgraphs for edge/core/data/ops, include async + fallback edges, keep labels concise.",
    mermaid: `flowchart LR
  subgraph edge["Edge"]
    U[Users]
    CDN[CDN]
    WAF[WAF]
    GW[API Gateway]
  end
  subgraph core["Core Services"]
    AUTH[Auth Service]
    BILL[Billing Service]
    INV[Inventory Service]
    ORD[Order Service]
    NOTIF[Notification Service]
  end
  subgraph data["Data Layer"]
    PG[(Postgres)]
    REDIS[(Redis)]
    MQ[(Message Queue)]
    S3[(Object Storage)]
  end
  subgraph ops["Ops"]
    LOG[Central Logging]
    METRIC[Metrics]
    TRACE[Tracing]
    ALERT[Alerting]
  end

  U --> CDN --> WAF --> GW
  GW --> AUTH
  GW --> BILL
  GW --> INV
  GW --> ORD
  AUTH --> REDIS
  BILL --> PG
  INV --> PG
  ORD --> PG
  ORD -->|publish event| MQ
  MQ --> NOTIF
  NOTIF --> S3
  AUTH -.token failure.-> ALERT
  GW -.rate limit.-> ALERT
  BILL --> TRACE
  INV --> TRACE
  ORD --> TRACE
  AUTH --> LOG
  BILL --> LOG
  INV --> LOG
  ORD --> LOG
  TRACE --> METRIC
  METRIC --> ALERT`,
  },
  {
    id: "k8s_deployment_release",
    title: "Kubernetes release pipeline",
    description: "CI/CD with approval gates, rollback, and verification loops",
    promptHint:
      "Use numbered stages left-to-right with decision nodes for rollback and gate checks.",
    mermaid: `flowchart LR
  subgraph s1["1. Build & Test"]
    A[Commit] --> B[Unit tests]
    B --> C[Build image]
  end
  subgraph s2["2. Security Gates"]
    C --> D[SCA scan]
    D --> E[Container scan]
    E --> F{Gate pass?}
  end
  subgraph s3["3. Deploy Staging"]
    F -->|Yes| G[Helm upgrade staging]
    G --> H[Smoke tests]
    H --> I{Pass?}
  end
  subgraph s4["4. Production"]
    I -->|Yes| J[Canary deploy]
    J --> K[Error budget check]
    K --> L{Healthy?}
  end
  subgraph s5["5. Outcome"]
    L -->|Yes| M[Promote to 100%]
    I -->|No| R[Fix and retry]
    F -->|No| R
    L -->|No| N[Rollback]
    N --> O[Incident + postmortem]
  end`,
  },
  {
    id: "decision_tree",
    title: "Decision tree",
    description: "Diamond decisions with outcomes",
    promptHint: "flowchart TD with decision diamonds and clear labels.",
    mermaid: `flowchart TD
  Start([Start]) --> Q{Traffic spike?}
  Q -->|Yes| Scale[Scale workers]
  Q -->|No| Monitor[Watch metrics]
  Scale --> Done([Done])
  Monitor --> Done`,
  },
  {
    id: "incident_response",
    title: "Incident response",
    description: "Triage → mitigate → communicate",
    promptHint: "LR flow with subgraphs for detection, response, comms.",
    mermaid: `flowchart LR
  subgraph det["Detection"]
    A[Alert fires] --> B[Triage severity]
  end
  subgraph resp["Response"]
    B --> C[Mitigate]
    C --> D[Verify fix]
  end
  subgraph com["Comms"]
    D --> E[Status update]
    E --> F[Postmortem]
  end`,
  },
  {
    id: "enterprise_rag_pipeline",
    title: "Enterprise RAG pipeline (complex)",
    description:
      "Edge → auth → gateway → ingestion/RAG → inference → safety → response → ops → release/DR",
    promptHint:
      "flowchart LR with many subgraphs, decisions, loops, dashed edges, and classDef for swimlanes.",
    mermaid: `flowchart LR
  subgraph c0["0. Clients"]
    U["Web / mobile / API clients"]
  end

  subgraph c1["1. Edge"]
    CDN["CDN + TLS"]
    WAF["WAF / bot rules"]
    LB["Load balancer"]
  end

  subgraph c2["2. Identity & session"]
    OIDC["OIDC / SSO"]
    TOK["Token mint + refresh"]
    RBAC{"Role OK?"}
  end

  subgraph c3["3. Gateway & policy"]
    GW["API gateway"]
    RL["Rate limits + quotas"]
    POL{"Policy pass?\\nPII / region / budget"}
    AUD["Audit log (append-only)"]
  end

  subgraph c4["4. Ingestion & knowledge"]
    ING["Ingestion workers"]
    CHUNK["Chunk + dedupe"]
    EMB["Embedding job"]
    VDB[("Vector index")]
    CACHE[("Redis cache")]
  end

  subgraph c5["5. Retrieval"]
    RTR["Hybrid retrieval\\nBM25 + vectors"]
    RERANK["Reranker"]
    CTX{"Context enough?"}
  end

  subgraph c6["6. Inference"]
    ROUTE{"Route model"}
    FAST["Fast model"]
    STRONG["Strong model"]
    TOOL["Tool / function calls"]
    AGG["Merge partials"]
  end

  subgraph c7["7. Safety & quality"]
    GUARD["Input/output guardrails"]
    PII["PII redaction"]
    JUDGE{"Auto-eval pass?"}
    HUMAN["Human review queue"]
  end

  subgraph c8["8. Response & contracts"]
    RESP["Assemble answer + citations"]
    SCHEMA{"Schema valid?"}
    API_OUT["Return to client"]
  end

  subgraph c9["9. Ops & economics"]
    MET["Metrics + traces"]
    COST["Cost + token accounting"]
    ALERT["Alerts + paging"]
  end

  subgraph c10["10. Release & DR"]
    FEAT{"Feature flag on?"}
    CAN["Canary cohort"]
    ERRB{"Error budget OK?"}
    ROLL["Rollback"]
    DR["Failover / read replica"]
  end

  U --> CDN --> WAF --> LB
  LB --> OIDC --> TOK --> RBAC
  RBAC -->|no| AUD
  RBAC -->|yes| GW

  GW --> RL --> POL
  POL -->|no| AUD
  POL -->|yes| ING

  ING --> CHUNK --> EMB --> VDB
  ING -.metadata.-> CACHE

  GW --> RTR
  RTR --> RERANK --> CTX
  CTX -->|no, widen search| RTR
  CTX -->|yes| ROUTE

  ROUTE -->|latency path| FAST
  ROUTE -->|quality path| STRONG
  FAST --> TOOL
  STRONG --> TOOL
  TOOL --> AGG

  AGG --> GUARD --> PII --> JUDGE
  JUDGE -->|fail| HUMAN
  JUDGE -->|pass| RESP

  HUMAN -.approved.-> RESP

  RESP --> SCHEMA
  SCHEMA -->|no| AGG
  SCHEMA -->|yes| API_OUT

  API_OUT --> MET
  GW --> MET
  POL --> COST
  JUDGE --> ALERT
  MET --> ERRB

  FEAT --> CAN
  CAN -.shadow traffic.-> MET
  ERRB -->|no| ROLL
  ERRB -->|yes| DR

  classDef cold fill:#f8fafc,stroke:#64748b,color:#0f172a
  classDef water fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef mint fill:#d1fae5,stroke:#059669,color:#0f172a
  classDef sand fill:#fef3c7,stroke:#d97706,color:#0f172a
  classDef danger fill:#fee2e2,stroke:#dc2626,color:#450a0a

  class U,CDN,WAF,LB cold
  class OIDC,TOK,RBAC water
  class GW,RL,POL,AUD water
  class ING,CHUNK,EMB,VDB,CACHE mint
  class RTR,RERANK,CTX,ROUTE,FAST,STRONG,TOOL,AGG mint
  class GUARD,PII,JUDGE,HUMAN sand
  class RESP,SCHEMA,API_OUT sand
  class MET,COST,ALERT,FEAT,CAN,ERRB,ROLL,DR danger`,
  },
  {
    id: "simple_sequence_hint",
    title: "API sequence (hint)",
    description: "Use sequenceDiagram for request flows in docs",
    promptHint: "Switch to sequenceDiagram when showing actor interactions.",
    mermaid: `sequenceDiagram
  participant U as User
  participant A as App
  participant M as Model
  U->>A: Paste idea
  A->>M: Generate diagram text
  M-->>A: Diagram text
  A-->>U: Render + export`,
  },
];

// Non-mermaid templates — at least 2 per diagram type
const NON_MERMAID_TEMPLATES: FlowchartTemplate[] = [
  // ── ECharts ────────────────────────────────────────────────────────────────
  {
    id: "echarts_sales_dashboard",
    title: "Sales dashboard — bar + line combo",
    description: "Monthly revenue bars with target line overlay",
    promptHint: "ECharts bar+line combo chart for monthly sales vs target",
    diagramType: "echarts",
    source: JSON.stringify({
      title: { text: "Monthly Sales vs Target", left: "center" },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { data: ["Revenue", "Target"], bottom: 0 },
      grid: { containLabel: true, left: "3%", right: "4%", bottom: "10%" },
      xAxis: { type: "category", data: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] },
      yAxis: { type: "value", axisLabel: { formatter: "${value}k" } },
      series: [
        { name: "Revenue", type: "bar", data: [42,58,67,71,85,92,78,95,103,88,112,125], itemStyle: { color: "#6366f1", borderRadius: [4,4,0,0] } },
        { name: "Target", type: "line", data: [60,65,70,75,80,85,90,95,100,105,110,120], smooth: true, lineStyle: { color: "#10b981", width: 2, type: "dashed" }, symbol: "circle", symbolSize: 6 }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "echarts_funnel",
    title: "Conversion funnel",
    description: "Sales funnel from visitors to closed deals",
    promptHint: "ECharts funnel chart for conversion pipeline",
    diagramType: "echarts",
    source: JSON.stringify({
      title: { text: "Sales Conversion Funnel", left: "center" },
      tooltip: { trigger: "item", formatter: "{b}: {c}%" },
      series: [{
        type: "funnel",
        left: "10%", width: "80%", min: 0, max: 100,
        minSize: "5%", maxSize: "100%",
        sort: "descending", gap: 4,
        label: { show: true, position: "inside", formatter: "{b}\n{c}%" },
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        data: [
          { value: 100, name: "Visitors", itemStyle: { color: "#6366f1" } },
          { value: 62, name: "Leads", itemStyle: { color: "#8b5cf6" } },
          { value: 38, name: "Qualified", itemStyle: { color: "#06b6d4" } },
          { value: 22, name: "Proposals", itemStyle: { color: "#10b981" } },
          { value: 11, name: "Closed", itemStyle: { color: "#f59e0b" } }
        ]
      }]
    }, null, 2),
    mermaid: "",
  },
  // ── Nivo ───────────────────────────────────────────────────────────────────
  {
    id: "nivo_budget_pie",
    title: "Budget breakdown — pie chart",
    description: "Department budget allocation as a pie chart",
    promptHint: "Nivo pie chart for budget allocation by department",
    diagramType: "nivo",
    source: JSON.stringify({
      type: "pie",
      data: [
        { id: "Engineering", value: 38, label: "Engineering" },
        { id: "Marketing", value: 22, label: "Marketing" },
        { id: "Sales", value: 18, label: "Sales" },
        { id: "Operations", value: 12, label: "Operations" },
        { id: "HR & Admin", value: 10, label: "HR & Admin" }
      ],
      colors: { scheme: "category10" }
    }, null, 2),
    mermaid: "",
  },
  {
    id: "nivo_performance_radar",
    title: "Team performance — radar chart",
    description: "Multi-axis radar comparing team metrics across quarters",
    promptHint: "Nivo radar chart comparing team performance dimensions",
    diagramType: "nivo",
    source: JSON.stringify({
      type: "radar",
      data: [
        { metric: "Velocity", Q1: 65, Q2: 72, Q3: 80, Q4: 88 },
        { metric: "Quality", Q1: 78, Q2: 81, Q3: 85, Q4: 89 },
        { metric: "Collab", Q1: 70, Q2: 74, Q3: 77, Q4: 83 },
        { metric: "Delivery", Q1: 60, Q2: 68, Q3: 75, Q4: 80 },
        { metric: "Learning", Q1: 55, Q2: 63, Q3: 70, Q4: 78 }
      ],
      keys: ["Q1", "Q2", "Q3", "Q4"],
      colors: { scheme: "nivo" }
    }, null, 2),
    mermaid: "",
  },
  // ── ReactFlow ──────────────────────────────────────────────────────────────
  {
    id: "reactflow_etl_pipeline",
    title: "ETL data pipeline",
    description: "Extract → Transform → Load with error branch",
    promptHint: "ReactFlow ETL pipeline with source, transform, and destination nodes",
    diagramType: "reactflow",
    source: JSON.stringify({
      nodes: [
        { id: "1", type: "input", position: { x: 50, y: 200 }, data: { label: "Data Source\n(DB / API)" } },
        { id: "2", position: { x: 280, y: 120 }, data: { label: "Extract", color: "#dbeafe" } },
        { id: "3", position: { x: 480, y: 120 }, data: { label: "Validate & Clean", color: "#ede9fe" } },
        { id: "4", position: { x: 680, y: 120 }, data: { label: "Transform", color: "#ede9fe" } },
        { id: "5", type: "output", position: { x: 880, y: 120 }, data: { label: "Load to Warehouse", color: "#dcfce7" } },
        { id: "6", position: { x: 480, y: 300 }, data: { label: "Dead-letter Queue", color: "#fee2e2" } }
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", label: "read", type: "smoothstep" },
        { id: "e2-3", source: "2", target: "3", label: "raw rows", type: "smoothstep" },
        { id: "e3-4", source: "3", target: "4", label: "valid", type: "smoothstep", animated: true },
        { id: "e3-6", source: "3", target: "6", label: "invalid", type: "smoothstep" },
        { id: "e4-5", source: "4", target: "5", label: "load", type: "smoothstep", animated: true }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "reactflow_microservices",
    title: "Microservices topology",
    description: "API gateway + 4 services + shared data layer",
    promptHint: "ReactFlow microservices architecture diagram",
    diagramType: "reactflow",
    source: JSON.stringify({
      nodes: [
        { id: "gw", type: "input", position: { x: 380, y: 50 }, data: { label: "API Gateway", color: "#fef3c7" } },
        { id: "auth", position: { x: 100, y: 200 }, data: { label: "Auth Service", color: "#dbeafe" } },
        { id: "user", position: { x: 300, y: 200 }, data: { label: "User Service", color: "#dbeafe" } },
        { id: "order", position: { x: 500, y: 200 }, data: { label: "Order Service", color: "#dbeafe" } },
        { id: "notify", position: { x: 700, y: 200 }, data: { label: "Notification Service", color: "#dbeafe" } },
        { id: "db", position: { x: 380, y: 360 }, data: { label: "Shared DB / Event Bus", color: "#f1f5f9" } }
      ],
      edges: [
        { id: "e-gw-auth", source: "gw", target: "auth", type: "smoothstep" },
        { id: "e-gw-user", source: "gw", target: "user", type: "smoothstep" },
        { id: "e-gw-order", source: "gw", target: "order", type: "smoothstep" },
        { id: "e-order-notify", source: "order", target: "notify", label: "event", type: "smoothstep", animated: true },
        { id: "e-user-db", source: "user", target: "db", type: "smoothstep" },
        { id: "e-order-db", source: "order", target: "db", type: "smoothstep" },
        { id: "e-auth-db", source: "auth", target: "db", type: "smoothstep" }
      ]
    }, null, 2),
    mermaid: "",
  },
  // ── Excalidraw ─────────────────────────────────────────────────────────────
  {
    id: "excalidraw_brainstorm",
    title: "Brainstorm whiteboard",
    description: "Central idea with 4 radiating branches",
    promptHint: "Excalidraw whiteboard brainstorm with central topic and grouped ideas",
    diagramType: "excalidraw",
    source: JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        { id: "c1", type: "ellipse", x: 330, y: 230, width: 180, height: 80, strokeColor: "#6366f1", backgroundColor: "#ede9fe", fillStyle: "solid", strokeWidth: 2, roughness: 1, opacity: 100, text: "", seed: 1 },
        { id: "t1", type: "text", x: 355, y: 258, width: 130, height: 25, text: "Central Idea", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle", strokeColor: "#4338ca", seed: 2 },
        { id: "b1", type: "rectangle", x: 50, y: 80, width: 160, height: 64, strokeColor: "#10b981", backgroundColor: "#d1fae5", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 3 },
        { id: "tb1", type: "text", x: 70, y: 100, width: 120, height: 25, text: "Idea A", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#065f46", seed: 4 },
        { id: "b2", type: "rectangle", x: 630, y: 80, width: 160, height: 64, strokeColor: "#f59e0b", backgroundColor: "#fef3c7", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 5 },
        { id: "tb2", type: "text", x: 650, y: 100, width: 120, height: 25, text: "Idea B", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#92400e", seed: 6 },
        { id: "b3", type: "rectangle", x: 50, y: 390, width: 160, height: 64, strokeColor: "#ef4444", backgroundColor: "#fee2e2", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 7 },
        { id: "tb3", type: "text", x: 70, y: 410, width: 120, height: 25, text: "Idea C", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#991b1b", seed: 8 },
        { id: "b4", type: "rectangle", x: 630, y: 390, width: 160, height: 64, strokeColor: "#8b5cf6", backgroundColor: "#f5f3ff", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 9 },
        { id: "tb4", type: "text", x: 650, y: 410, width: 120, height: 25, text: "Idea D", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#5b21b6", seed: 10 },
        { id: "a1", type: "arrow", x: 210, y: 112, width: 120, height: 158, points: [[0,0],[120,158]], strokeColor: "#94a3b8", strokeWidth: 1, roughness: 1, opacity: 80, seed: 11 },
        { id: "a2", type: "arrow", x: 510, y: 270, width: 120, height: -158, points: [[0,0],[120,-158]], strokeColor: "#94a3b8", strokeWidth: 1, roughness: 1, opacity: 80, seed: 12 },
        { id: "a3", type: "arrow", x: 210, y: 380, width: 120, height: -108, points: [[0,0],[120,-108]], strokeColor: "#94a3b8", strokeWidth: 1, roughness: 1, opacity: 80, seed: 13 },
        { id: "a4", type: "arrow", x: 510, y: 270, width: 120, height: 152, points: [[0,0],[120,152]], strokeColor: "#94a3b8", strokeWidth: 1, roughness: 1, opacity: 80, seed: 14 }
      ],
      appState: { gridSize: null, viewBackgroundColor: "#ffffff" }
    }, null, 2),
    mermaid: "",
  },
  {
    id: "excalidraw_architecture",
    title: "System architecture diagram",
    description: "Frontend → API → services → DB — hand-drawn style",
    promptHint: "Excalidraw system architecture diagram with frontend, API, microservices, and database tiers",
    diagramType: "excalidraw",
    source: JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        { id: "fe", type: "rectangle", x: 300, y: 40, width: 200, height: 60, strokeColor: "#6366f1", backgroundColor: "#ede9fe", fillStyle: "solid", strokeWidth: 2, roughness: 1, opacity: 100, seed: 20 },
        { id: "fe_t", type: "text", x: 330, y: 60, width: 140, height: 20, text: "React Frontend", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#4338ca", seed: 21 },
        { id: "api", type: "rectangle", x: 300, y: 160, width: 200, height: 60, strokeColor: "#06b6d4", backgroundColor: "#cffafe", fillStyle: "solid", strokeWidth: 2, roughness: 1, opacity: 100, seed: 22 },
        { id: "api_t", type: "text", x: 330, y: 180, width: 140, height: 20, text: "Next.js API Routes", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#0e7490", seed: 23 },
        { id: "svc1", type: "rectangle", x: 100, y: 290, width: 160, height: 60, strokeColor: "#10b981", backgroundColor: "#d1fae5", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 24 },
        { id: "svc1_t", type: "text", x: 115, y: 310, width: 130, height: 20, text: "Auth Service", fontSize: 14, fontFamily: 1, textAlign: "center", strokeColor: "#065f46", seed: 25 },
        { id: "svc2", type: "rectangle", x: 320, y: 290, width: 160, height: 60, strokeColor: "#10b981", backgroundColor: "#d1fae5", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 26 },
        { id: "svc2_t", type: "text", x: 335, y: 310, width: 130, height: 20, text: "Data Service", fontSize: 14, fontFamily: 1, textAlign: "center", strokeColor: "#065f46", seed: 27 },
        { id: "svc3", type: "rectangle", x: 540, y: 290, width: 160, height: 60, strokeColor: "#10b981", backgroundColor: "#d1fae5", fillStyle: "solid", strokeWidth: 1, roughness: 1, opacity: 100, seed: 28 },
        { id: "svc3_t", type: "text", x: 555, y: 310, width: 130, height: 20, text: "AI Service", fontSize: 14, fontFamily: 1, textAlign: "center", strokeColor: "#065f46", seed: 29 },
        { id: "db", type: "rectangle", x: 280, y: 420, width: 240, height: 60, strokeColor: "#8b5cf6", backgroundColor: "#f5f3ff", fillStyle: "solid", strokeWidth: 2, roughness: 1, opacity: 100, seed: 30 },
        { id: "db_t", type: "text", x: 300, y: 440, width: 200, height: 20, text: "PostgreSQL Database", fontSize: 16, fontFamily: 1, textAlign: "center", strokeColor: "#5b21b6", seed: 31 },
        { id: "arr1", type: "arrow", x: 400, y: 100, width: 0, height: 60, points: [[0,0],[0,60]], strokeColor: "#64748b", strokeWidth: 2, roughness: 1, opacity: 100, seed: 32 },
        { id: "arr2", type: "arrow", x: 360, y: 220, width: -80, height: 70, points: [[0,0],[-80,70]], strokeColor: "#64748b", strokeWidth: 2, roughness: 1, opacity: 100, seed: 33 },
        { id: "arr3", type: "arrow", x: 400, y: 220, width: 0, height: 70, points: [[0,0],[0,70]], strokeColor: "#64748b", strokeWidth: 2, roughness: 1, opacity: 100, seed: 34 },
        { id: "arr4", type: "arrow", x: 440, y: 220, width: 80, height: 70, points: [[0,0],[80,70]], strokeColor: "#64748b", strokeWidth: 2, roughness: 1, opacity: 100, seed: 35 },
        { id: "arr5", type: "arrow", x: 400, y: 350, width: 0, height: 70, points: [[0,0],[0,70]], strokeColor: "#64748b", strokeWidth: 2, roughness: 1, opacity: 100, seed: 36 }
      ],
      appState: { gridSize: null, viewBackgroundColor: "#f8fafc" }
    }, null, 2),
    mermaid: "",
  },
  // ── freeform ───────────────────────────────────────────────────────────────
  {
    id: "freeform_org_chart",
    title: "Org chart",
    description: "CEO → VPs → department leads",
    promptHint: "freeform org chart with CEO, VP level, and team leads",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ceo", type: "rectangle", name: "CEO", x: 340, y: 40, width: 160, height: 56, fill: "5", text: { content: "CEO" } },
        { id: "vp_eng", type: "rectangle", name: "VP Engineering", x: 80, y: 160, width: 160, height: 56, fill: "4", text: { content: "VP Engineering" } },
        { id: "vp_prod", type: "rectangle", name: "VP Product", x: 340, y: 160, width: 160, height: 56, fill: "4", text: { content: "VP Product" } },
        { id: "vp_sales", type: "rectangle", name: "VP Sales", x: 600, y: 160, width: 160, height: 56, fill: "4", text: { content: "VP Sales" } },
        { id: "lead_fe", type: "rectangle", name: "Frontend Lead", x: 40, y: 280, width: 120, height: 48, fill: "6", text: { content: "Frontend Lead" } },
        { id: "lead_be", type: "rectangle", name: "Backend Lead", x: 180, y: 280, width: 120, height: 48, fill: "6", text: { content: "Backend Lead" } },
        { id: "lead_des", type: "rectangle", name: "Design Lead", x: 340, y: 280, width: 120, height: 48, fill: "6", text: { content: "Design Lead" } },
        { id: "lead_sales", type: "rectangle", name: "Sales Lead", x: 600, y: 280, width: 120, height: 48, fill: "6", text: { content: "Sales Lead" } },
        { id: "a1", type: "arrow", start: { shapeId: "ceo", anchor: "auto" }, end: { shapeId: "vp_eng", anchor: "auto" } },
        { id: "a2", type: "arrow", start: { shapeId: "ceo", anchor: "auto" }, end: { shapeId: "vp_prod", anchor: "auto" } },
        { id: "a3", type: "arrow", start: { shapeId: "ceo", anchor: "auto" }, end: { shapeId: "vp_sales", anchor: "auto" } },
        { id: "a4", type: "arrow", start: { shapeId: "vp_eng", anchor: "auto" }, end: { shapeId: "lead_fe", anchor: "auto" } },
        { id: "a5", type: "arrow", start: { shapeId: "vp_eng", anchor: "auto" }, end: { shapeId: "lead_be", anchor: "auto" } },
        { id: "a6", type: "arrow", start: { shapeId: "vp_prod", anchor: "auto" }, end: { shapeId: "lead_des", anchor: "auto" } },
        { id: "a7", type: "arrow", start: { shapeId: "vp_sales", anchor: "auto" }, end: { shapeId: "lead_sales", anchor: "auto" } }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "freeform_user_journey",
    title: "User journey map",
    description: "5-phase user journey with touchpoints and sticky notes",
    promptHint: "freeform user journey map with phases, touchpoints, and sticky notes",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "hdr", type: "text", name: "header", x: 300, y: 20, width: 300, height: 40, text: { content: "User Journey: Onboarding" } },
        { id: "f_journey", type: "frame", name: "Phases", x: 20, y: 70, width: 880, height: 320, text: { content: "Onboarding Phases" } },
        { id: "p1", type: "rectangle", name: "Awareness", x: 40, y: 100, width: 140, height: 60, fill: "5", frameId: "f_journey", text: { content: "Awareness" } },
        { id: "p2", type: "rectangle", name: "Sign-up", x: 220, y: 100, width: 140, height: 60, fill: "4", frameId: "f_journey", text: { content: "Sign-up" } },
        { id: "p3", type: "rectangle", name: "Onboarding", x: 400, y: 100, width: 140, height: 60, fill: "2", frameId: "f_journey", text: { content: "Onboarding" } },
        { id: "p4", type: "rectangle", name: "First Value", x: 580, y: 100, width: 140, height: 60, fill: "3", frameId: "f_journey", text: { content: "First Value" } },
        { id: "p5", type: "rectangle", name: "Retention", x: 740, y: 100, width: 140, height: 60, fill: "1", frameId: "f_journey", text: { content: "Retention" } },
        { id: "a1", type: "arrow", start: { shapeId: "p1", anchor: "auto" }, end: { shapeId: "p2", anchor: "auto" } },
        { id: "a2", type: "arrow", start: { shapeId: "p2", anchor: "auto" }, end: { shapeId: "p3", anchor: "auto" } },
        { id: "a3", type: "arrow", start: { shapeId: "p3", anchor: "auto" }, end: { shapeId: "p4", anchor: "auto" } },
        { id: "a4", type: "arrow", start: { shapeId: "p4", anchor: "auto" }, end: { shapeId: "p5", anchor: "auto" } },
        { id: "note1", type: "sticky", name: "touchpoints", x: 40, y: 200, width: 240, height: 150, fill: "3", frameId: "f_journey", text: { content: "Touchpoints:\n• Landing Page\n• OAuth Signup\n• Welcome Email" } },
        { id: "note2", type: "sticky", name: "goals", x: 580, y: 200, width: 240, height: 150, fill: "3", frameId: "f_journey", text: { content: "Key Actions:\n• Create first diagram\n• Invite teammate\n• Upgrade to Pro" } }
      ]
    }, null, 2),
    mermaid: "",
  },
  // ── BPMN ───────────────────────────────────────────────────────────────────
  {
    id: "bpmn_order_fulfillment",
    title: "Order fulfillment process",
    description: "Customer order → payment → warehouse → shipping",
    promptHint: "BPMN order fulfillment with payment gateway and warehouse dispatch",
    diagramType: "bpmn",
    source: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="order-fulfillment" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="Start_1" name="Order Received"/>
    <bpmn2:task id="Task_1" name="Validate Order"/>
    <bpmn2:task id="Task_2" name="Process Payment"/>
    <bpmn2:exclusiveGateway id="GW_1" name="Payment OK?"/>
    <bpmn2:task id="Task_3" name="Pick &amp; Pack Items"/>
    <bpmn2:task id="Task_4" name="Ship Order"/>
    <bpmn2:endEvent id="End_1" name="Order Shipped"/>
    <bpmn2:task id="Task_5" name="Notify Customer — Failed"/>
    <bpmn2:endEvent id="End_2" name="Order Cancelled"/>
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_1" targetRef="Task_2"/>
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_2" targetRef="GW_1"/>
    <bpmn2:sequenceFlow id="sf4" name="Yes" sourceRef="GW_1" targetRef="Task_3"/>
    <bpmn2:sequenceFlow id="sf5" sourceRef="Task_3" targetRef="Task_4"/>
    <bpmn2:sequenceFlow id="sf6" sourceRef="Task_4" targetRef="End_1"/>
    <bpmn2:sequenceFlow id="sf7" name="No" sourceRef="GW_1" targetRef="Task_5"/>
    <bpmn2:sequenceFlow id="sf8" sourceRef="Task_5" targetRef="End_2"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="s_Start_1" bpmnElement="Start_1"><dc:Bounds x="80" y="162" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_1" bpmnElement="Task_1"><dc:Bounds x="180" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_2" bpmnElement="Task_2"><dc:Bounds x="370" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_GW_1" bpmnElement="GW_1" isMarkerVisible="true"><dc:Bounds x="560" y="155" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_3" bpmnElement="Task_3"><dc:Bounds x="680" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_4" bpmnElement="Task_4"><dc:Bounds x="870" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_End_1" bpmnElement="End_1"><dc:Bounds x="1060" y="162" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_5" bpmnElement="Task_5"><dc:Bounds x="680" y="300" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_End_2" bpmnElement="End_2"><dc:Bounds x="870" y="322" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="e_sf1" bpmnElement="sf1"><di:waypoint x="116" y="180"/><di:waypoint x="180" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf2" bpmnElement="sf2"><di:waypoint x="300" y="180"/><di:waypoint x="370" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf3" bpmnElement="sf3"><di:waypoint x="490" y="180"/><di:waypoint x="560" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf4" bpmnElement="sf4"><di:waypoint x="610" y="180"/><di:waypoint x="680" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf5" bpmnElement="sf5"><di:waypoint x="800" y="180"/><di:waypoint x="870" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf6" bpmnElement="sf6"><di:waypoint x="990" y="180"/><di:waypoint x="1060" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf7" bpmnElement="sf7"><di:waypoint x="585" y="205"/><di:waypoint x="585" y="340"/><di:waypoint x="680" y="340"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf8" bpmnElement="sf8"><di:waypoint x="800" y="340"/><di:waypoint x="870" y="340"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
    mermaid: "",
  },
  {
    id: "bpmn_incident_response",
    title: "Incident response workflow",
    description: "Alert → triage → escalation → resolution",
    promptHint: "BPMN IT incident response with severity triage and escalation path",
    diagramType: "bpmn",
    source: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="incident-response" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="Start_1" name="Alert Triggered"/>
    <bpmn2:task id="Task_1" name="Acknowledge Alert"/>
    <bpmn2:task id="Task_2" name="Assess Severity"/>
    <bpmn2:exclusiveGateway id="GW_1" name="Critical?"/>
    <bpmn2:task id="Task_3" name="Page On-call Engineer"/>
    <bpmn2:task id="Task_4" name="Create Incident Ticket"/>
    <bpmn2:task id="Task_5" name="Mitigate &amp; Resolve"/>
    <bpmn2:task id="Task_6" name="Post-Mortem Review"/>
    <bpmn2:endEvent id="End_1" name="Incident Closed"/>
    <bpmn2:task id="Task_7" name="Self-heal / Auto-fix"/>
    <bpmn2:endEvent id="End_2" name="Auto-resolved"/>
    <bpmn2:sequenceFlow id="sf1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn2:sequenceFlow id="sf2" sourceRef="Task_1" targetRef="Task_2"/>
    <bpmn2:sequenceFlow id="sf3" sourceRef="Task_2" targetRef="GW_1"/>
    <bpmn2:sequenceFlow id="sf4" name="Yes" sourceRef="GW_1" targetRef="Task_3"/>
    <bpmn2:sequenceFlow id="sf5" sourceRef="Task_3" targetRef="Task_4"/>
    <bpmn2:sequenceFlow id="sf6" sourceRef="Task_4" targetRef="Task_5"/>
    <bpmn2:sequenceFlow id="sf7" sourceRef="Task_5" targetRef="Task_6"/>
    <bpmn2:sequenceFlow id="sf8" sourceRef="Task_6" targetRef="End_1"/>
    <bpmn2:sequenceFlow id="sf9" name="No" sourceRef="GW_1" targetRef="Task_7"/>
    <bpmn2:sequenceFlow id="sf10" sourceRef="Task_7" targetRef="End_2"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="s_Start_1" bpmnElement="Start_1"><dc:Bounds x="60" y="162" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_1" bpmnElement="Task_1"><dc:Bounds x="160" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_2" bpmnElement="Task_2"><dc:Bounds x="350" y="140" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_GW_1" bpmnElement="GW_1" isMarkerVisible="true"><dc:Bounds x="540" y="155" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_3" bpmnElement="Task_3"><dc:Bounds x="660" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_4" bpmnElement="Task_4"><dc:Bounds x="850" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_5" bpmnElement="Task_5"><dc:Bounds x="1040" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_6" bpmnElement="Task_6"><dc:Bounds x="1230" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_End_1" bpmnElement="End_1"><dc:Bounds x="1420" y="82" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_Task_7" bpmnElement="Task_7"><dc:Bounds x="660" y="280" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s_End_2" bpmnElement="End_2"><dc:Bounds x="850" y="302" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="e_sf1" bpmnElement="sf1"><di:waypoint x="96" y="180"/><di:waypoint x="160" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf2" bpmnElement="sf2"><di:waypoint x="280" y="180"/><di:waypoint x="350" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf3" bpmnElement="sf3"><di:waypoint x="470" y="180"/><di:waypoint x="540" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf4" bpmnElement="sf4"><di:waypoint x="565" y="155"/><di:waypoint x="565" y="100"/><di:waypoint x="660" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf5" bpmnElement="sf5"><di:waypoint x="780" y="100"/><di:waypoint x="850" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf6" bpmnElement="sf6"><di:waypoint x="970" y="100"/><di:waypoint x="1040" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf7" bpmnElement="sf7"><di:waypoint x="1160" y="100"/><di:waypoint x="1230" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf8" bpmnElement="sf8"><di:waypoint x="1350" y="100"/><di:waypoint x="1420" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf9" bpmnElement="sf9"><di:waypoint x="565" y="205"/><di:waypoint x="565" y="320"/><di:waypoint x="660" y="320"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="e_sf10" bpmnElement="sf10"><di:waypoint x="780" y="320"/><di:waypoint x="850" y="320"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`,
    mermaid: "",
  },
  // ── Social Card Templates ──────────────────────────────────────────────────
  {
    id: "timeline_startup_journey",
    title: "Startup journey timeline",
    description: "Milestones from first prototype to 10k users",
    promptHint: "Timeline of a startup's first year",
    diagramType: "timeline",
    source: JSON.stringify({
      type: "timeline",
      title: "From idea to 10k users",
      items: [
        { date: "Jan 2025", label: "First prototype" },
        { date: "Mar 2025", label: "Public beta", description: "500 signups in week one" },
        { date: "Jun 2025", label: "Product Hunt #1" },
        { date: "Dec 2025", label: "10,000 users" },
      ],
    }, null, 2),
    mermaid: "",
  },
  {
    id: "versus_remote_office",
    title: "Remote vs Office",
    description: "Side-by-side comparison card",
    promptHint: "Compare remote work and office work",
    diagramType: "versus",
    source: JSON.stringify({
      type: "versus",
      title: "Remote vs Office",
      left: { name: "Remote", points: ["No commute", "Deep focus time", "Hire anywhere"] },
      right: { name: "Office", points: ["Faster onboarding", "Spontaneous collaboration", "Clear work-life boundary"] },
    }, null, 2),
    mermaid: "",
  },
  {
    id: "matrix_effort_impact",
    title: "Effort vs impact matrix",
    description: "Prioritize features in a 2x2 quadrant",
    promptHint: "Effort vs impact matrix for feature planning",
    diagramType: "matrix2x2",
    source: JSON.stringify({
      type: "matrix2x2",
      title: "Feature priorities",
      xAxis: { low: "Low effort", high: "High effort" },
      yAxis: { low: "Low impact", high: "High impact" },
      items: [
        { label: "Dark mode", x: 20, y: 75 },
        { label: "SSO", x: 80, y: 85 },
        { label: "Emoji reactions", x: 15, y: 25 },
        { label: "Plugin API", x: 90, y: 40 },
      ],
      quadrantLabels: ["Quick wins", "Big bets", "Fill-ins", "Money pits"],
    }, null, 2),
    mermaid: "",
  },
  {
    id: "funnel_saas_signup",
    title: "SaaS signup funnel",
    description: "Visitors to paid conversions with drop-off notes",
    promptHint: "SaaS conversion funnel with numbers",
    diagramType: "funnel",
    source: JSON.stringify({
      type: "funnel",
      title: "SaaS signup funnel",
      stages: [
        { label: "Site visitors", value: "40,000" },
        { label: "Started trial", value: "2,400", note: "6% conversion" },
        { label: "Activated", value: "1,100" },
        { label: "Paid plan", value: "310" },
      ],
    }, null, 2),
    mermaid: "",
  },
];

export const ALL_TEMPLATES: FlowchartTemplate[] = [...TEMPLATES, ...NON_MERMAID_TEMPLATES];

export function getTemplate(id: string): FlowchartTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/** Get the source content for a template, regardless of diagram type */
export function getTemplateSource(t: FlowchartTemplate): string {
  return t.source ?? t.mermaid;
}

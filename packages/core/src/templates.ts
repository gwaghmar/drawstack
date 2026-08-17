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
  {
    id: "freeform_cloud_microservices",
    title: "Cloud microservices architecture",
    description: "Multi-tier microservices with API gateway, databases, and external cloud",
    promptHint: "Cloud microservices architecture with API Gateway, Auth, Database, and external Stripe cloud",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      renderMode: "clean",
      shapes: [
        { id: "client", type: "rectangle", x: 40, y: 150, width: 140, height: 70, fill: "5", stroke: "#2563eb", text: { content: "Web / Mobile Client", bold: true } },
        { id: "gateway", type: "rectangle", x: 250, y: 145, width: 150, height: 80, fill: "1", stroke: "#0284c7", text: { content: "API Gateway", bold: true } },
        { id: "auth_svc", type: "rectangle", x: 470, y: 60, width: 150, height: 75, fill: "3", stroke: "#d97706", text: { content: "Auth Service", bold: true } },
        { id: "order_svc", type: "rectangle", x: 470, y: 230, width: 150, height: 75, fill: "6", stroke: "#7c3aed", text: { content: "Order Service", bold: true } },
        { id: "db_main", type: "cylinder", x: 690, y: 50, width: 130, height: 95, fill: "4", stroke: "#16a34a", text: { content: "User DB", bold: true } },
        { id: "db_orders", type: "cylinder", x: 690, y: 220, width: 130, height: 95, fill: "4", stroke: "#16a34a", text: { content: "Orders DB", bold: true } },
        { id: "stripe_cloud", type: "cloud", x: 690, y: 360, width: 160, height: 90, fill: "2", stroke: "#059669", text: { content: "Stripe API", bold: true } },
        { id: "a1", type: "arrow", start: { shapeId: "client", anchor: "right" }, end: { shapeId: "gateway", anchor: "left" }, label: "HTTPS" },
        { id: "a2", type: "arrow", start: { shapeId: "gateway", anchor: "right" }, end: { shapeId: "auth_svc", anchor: "left" }, label: "Verify Token" },
        { id: "a3", type: "arrow", start: { shapeId: "gateway", anchor: "right" }, end: { shapeId: "order_svc", anchor: "left" }, label: "Place Order" },
        { id: "a4", type: "arrow", start: { shapeId: "auth_svc", anchor: "right" }, end: { shapeId: "db_main", anchor: "left" } },
        { id: "a5", type: "arrow", start: { shapeId: "order_svc", anchor: "right" }, end: { shapeId: "db_orders", anchor: "left" } },
        { id: "a6", type: "arrow", start: { shapeId: "order_svc", anchor: "bottom" }, end: { shapeId: "stripe_cloud", anchor: "left" }, label: "Charge Card" },
      ],
    }, null, 2),
    mermaid: "",
  },
  {
    id: "freeform_sprint_kanban",
    title: "Sprint ideation & Kanban board",
    description: "Categorized frames with pastel sticky notes and team tasks",
    promptHint: "Kanban sprint board with Backlog, Doing, and Done columns and sticky notes",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      renderMode: "sketchy",
      shapes: [
        { id: "f_backlog", type: "frame", name: "Backlog", x: 40, y: 40, width: 230, height: 380, fill: "transparent" },
        { id: "f_doing", type: "frame", name: "In Progress", x: 300, y: 40, width: 230, height: 380, fill: "transparent" },
        { id: "f_done", type: "frame", name: "Done", x: 560, y: 40, width: 230, height: 380, fill: "transparent" },
        { id: "n1", type: "sticky", parentId: "f_backlog", x: 60, y: 80, width: 190, height: 90, fill: "3", text: { content: "Design dark mode palette", fontSize: 13 } },
        { id: "n2", type: "sticky", parentId: "f_backlog", x: 60, y: 190, width: 190, height: 90, fill: "5", text: { content: "Implement Webhook retries", fontSize: 13 } },
        { id: "n3", type: "sticky", parentId: "f_doing", x: 320, y: 80, width: 190, height: 90, fill: "1", text: { content: "Canvas Rough.js render engine", fontSize: 13 } },
        { id: "n4", type: "sticky", parentId: "f_done", x: 580, y: 80, width: 190, height: 90, fill: "4", text: { content: "Stripe billing checkout integration", fontSize: 13 } },
        { id: "n5", type: "sticky", parentId: "f_done", x: 580, y: 190, width: 190, height: 90, fill: "4", text: { content: "Next.js 16 App Router migration", fontSize: 13 } },
      ],
    }, null, 2),
    mermaid: "",
  },
  {
    id: "freeform_decision_logic_tree",
    title: "Decision logic tree",
    description: "Flowchart with start state, decision diamonds, and outcome badges",
    promptHint: "Decision tree flowchart with diamond gates and terminal outcomes",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      renderMode: "clean",
      shapes: [
        { id: "start", type: "ellipse", x: 60, y: 160, width: 120, height: 60, fill: "1", stroke: "#0284c7", text: { content: "New User Event", bold: true } },
        { id: "check_auth", type: "diamond", x: 250, y: 140, width: 160, height: 100, fill: "3", stroke: "#d97706", text: { content: "Has Valid Token?", bold: true } },
        { id: "check_role", type: "diamond", x: 480, y: 80, width: 160, height: 100, fill: "3", stroke: "#d97706", text: { content: "Admin Role?", bold: true } },
        { id: "login_redirect", type: "rectangle", x: 250, y: 310, width: 160, height: 70, fill: "2", stroke: "#dc2626", text: { content: "Redirect to /login" } },
        { id: "admin_dash", type: "hexagon", x: 710, y: 85, width: 150, height: 90, fill: "6", stroke: "#7c3aed", text: { content: "Admin Dashboard", bold: true } },
        { id: "user_dash", type: "hexagon", x: 710, y: 220, width: 150, height: 90, fill: "5", stroke: "#2563eb", text: { content: "User Dashboard", bold: true } },
        { id: "a1", type: "arrow", start: { shapeId: "start" }, end: { shapeId: "check_auth" } },
        { id: "a2", type: "arrow", start: { shapeId: "check_auth", anchor: "top" }, end: { shapeId: "check_role", anchor: "left" }, label: "Yes" },
        { id: "a3", type: "arrow", start: { shapeId: "check_auth", anchor: "bottom" }, end: { shapeId: "login_redirect", anchor: "top" }, label: "No" },
        { id: "a4", type: "arrow", start: { shapeId: "check_role", anchor: "right" }, end: { shapeId: "admin_dash", anchor: "left" }, label: "Yes" },
        { id: "a5", type: "arrow", start: { shapeId: "check_role", anchor: "bottom" }, end: { shapeId: "user_dash", anchor: "left" }, label: "No" },
      ],
    }, null, 2),
    mermaid: "",
  },
];

export const ALL_TEMPLATES: FlowchartTemplate[] = TEMPLATES;

export function getTemplate(id: string): FlowchartTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateSource(t: FlowchartTemplate): string {
  return t.source ?? t.mermaid;
}

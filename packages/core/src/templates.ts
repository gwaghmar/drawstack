/** Prompt + text diagram starters for FigJam-style pipelines and common flows */
import type { DiagramType } from "./diagram-types.js";

export type FlowchartTemplate = {
  id: string;
  title: string;
  description: string;
  /** Short instruction for LLM / user */
  promptHint: string;
  /** Diagram type for this template — defaults to "freeform" */
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
  {
  "id": "hybrid_saas_dashboard",
  "title": "SaaS Dashboard Widget (Hybrid)",
  "description": "An interactive React dashboard powered by ui_node.",
  "promptHint": "A live interactive SaaS dashboard using ui_node with tabs and charts.",
  "diagramType": "freeform",
  "source": "{\n  \"version\": 1,\n  \"shapes\": [\n    {\n      \"id\": \"ui1\",\n      \"type\": \"ui_node\",\n      \"x\": 100,\n      \"y\": 100,\n      \"width\": 400,\n      \"height\": 500,\n      \"code\": \"function Dashboard() {\\n  const [activeTab, setActiveTab] = useState(\\\"Overview\\\");\\n  \\n  return (\\n    <div className=\\\"flex flex-col h-full w-full bg-slate-50 text-slate-900 p-4 font-sans\\\">\\n      <div className=\\\"flex justify-between items-center mb-6\\\">\\n        <Typography variant=\\\"h3\\\" className=\\\"font-bold\\\">SaaS Metrics</Typography>\\n        <Badge variant=\\\"success\\\">Live System</Badge>\\n      </div>\\n      \\n      <Tabs tabs={[\\\"Overview\\\", \\\"Analytics\\\", \\\"Reports\\\"]} activeTab={activeTab} onChange={setActiveTab} className=\\\"mb-6\\\" />\\n      \\n      {activeTab === \\\"Overview\\\" && (\\n        <div className=\\\"flex flex-col gap-4\\\">\\n          <div className=\\\"grid grid-cols-2 gap-4\\\">\\n            <Card>\\n              <Typography variant=\\\"h4\\\" className=\\\"font-bold text-2xl mb-1\\\">$45.2k</Typography>\\n              <Typography variant=\\\"body\\\" className=\\\"text-slate-500\\\">MRR (+12%)</Typography>\\n            </Card>\\n            <Card>\\n              <Typography variant=\\\"h4\\\" className=\\\"font-bold text-2xl mb-1\\\">1,204</Typography>\\n              <Typography variant=\\\"body\\\" className=\\\"text-slate-500\\\">Active Users</Typography>\\n            </Card>\\n          </div>\\n          \\n          <Card className=\\\"h-48\\\">\\n            <Typography variant=\\\"body\\\" className=\\\"font-bold mb-2\\\">Revenue Growth</Typography>\\n            <BarChart data={[12, 19, 15, 22, 28, 35]} />\\n          </Card>\\n        </div>\\n      )}\\n      \\n      {activeTab === \\\"Analytics\\\" && (\\n        <Card className=\\\"h-64 flex flex-col items-center justify-center\\\">\\n          <Typography variant=\\\"body\\\" className=\\\"font-bold mb-4\\\">User Demographics</Typography>\\n          <div className=\\\"h-40 w-40\\\">\\n            <DonutChart data={[40, 30, 20, 10]} />\\n          </div>\\n        </Card>\\n      )}\\n      \\n      {activeTab === \\\"Reports\\\" && (\\n        <Card className=\\\"flex-1 overflow-auto p-2\\\">\\n          <DataTable \\n            headers={[\\\"Invoice\\\", \\\"Amount\\\", \\\"Status\\\"]} \\n            rows={[\\n              [\\\"INV-001\\\", \\\"$120.00\\\", \\\"Paid\\\"],\\n              [\\\"INV-002\\\", \\\"$250.00\\\", \\\"Pending\\\"],\\n              [\\\"INV-003\\\", \\\"$99.00\\\", \\\"Paid\\\"],\\n            ]} \\n          />\\n        </Card>\\n      )}\\n    </div>\\n  );\\n}\\nrender(<Dashboard />);\"\n    }\n  ]\n}",
  "mermaid": ""
},
  {
  "id": "hybrid_live_chat",
  "title": "Multiplayer Live Chat (Hybrid)",
  "description": "Real-time collaborative chat using useSharedState.",
  "promptHint": "A multiplayer live chat interface using useSharedState in ui_node.",
  "diagramType": "freeform",
  "source": "{\n  \"version\": 1,\n  \"shapes\": [\n    {\n      \"id\": \"ui2\",\n      \"type\": \"ui_node\",\n      \"x\": 100,\n      \"y\": 100,\n      \"width\": 350,\n      \"height\": 450,\n      \"code\": \"function LiveChat() {\\n  const [messages, setMessages] = useSharedState(\\\"chat_msgs\\\", [\\n    { sender: \\\"System\\\", text: \\\"Welcome to the chat!\\\" }\\n  ]);\\n  const [input, setInput] = useState(\\\"\\\");\\n  \\n  const handleSend = () => {\\n    if (!input.trim()) return;\\n    setMessages([...messages, { sender: \\\"User\\\", text: input }]);\\n    setInput(\\\"\\\");\\n  };\\n\\n  return (\\n    <div className=\\\"flex flex-col h-full w-full bg-white border border-slate-200 rounded-lg shadow-sm font-sans\\\">\\n      <div className=\\\"bg-slate-800 text-white p-3 font-bold text-sm\\\">\\n        Team Sync (Multiplayer)\\n      </div>\\n      \\n      <div className=\\\"flex-1 overflow-auto p-4 flex flex-col gap-3 bg-slate-50\\\">\\n        {messages.map((m, i) => (\\n          <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.sender === 'User' ? 'bg-blue-500 text-white self-end' : 'bg-white border border-slate-200 text-slate-800 self-start'}`}>\\n            <div className=\\\"text-xs opacity-70 mb-1 font-bold\\\">{m.sender}</div>\\n            <div className=\\\"text-sm\\\">{m.text}</div>\\n          </div>\\n        ))}\\n      </div>\\n      \\n      <div className=\\\"p-3 bg-white border-t border-slate-200 flex gap-2\\\">\\n        <Input \\n          value={input} \\n          onChange={(e) => setInput(e.target.value)} \\n          placeholder=\\\"Type a message...\\\" \\n          onKeyDown={(e) => e.key === 'Enter' && handleSend()}\\n        />\\n        <Button onClick={handleSend} variant=\\\"primary\\\">Send</Button>\\n      </div>\\n    </div>\\n  );\\n}\\nrender(<LiveChat />);\"\n    }\n  ]\n}",
  "mermaid": ""
},
  {
  "id": "hybrid_ecommerce_checkout",
  "title": "Dynamic Checkout (Hybrid)",
  "description": "A pricing calculator using Select, Slider, and Toggle.",
  "promptHint": "A dynamic SaaS pricing calculator using ui_node.",
  "diagramType": "freeform",
  "source": "{\n  \"version\": 1,\n  \"shapes\": [\n    {\n      \"id\": \"ui3\",\n      \"type\": \"ui_node\",\n      \"x\": 100,\n      \"y\": 100,\n      \"width\": 400,\n      \"height\": 480,\n      \"code\": \"function Checkout() {\\n  const [plan, setPlan] = useState(\\\"pro\\\");\\n  const [users, setUsers] = useState(5);\\n  const [annual, setAnnual] = useState(true);\\n  \\n  const basePrice = plan === \\\"pro\\\" ? 20 : (plan === \\\"enterprise\\\" ? 50 : 10);\\n  const multiplier = annual ? 0.8 : 1;\\n  const total = Math.round(basePrice * users * multiplier);\\n\\n  return (\\n    <div className=\\\"p-6 bg-white w-full h-full flex flex-col font-sans\\\">\\n      <Typography variant=\\\"h3\\\" className=\\\"font-bold mb-4\\\">Pricing Calculator</Typography>\\n      \\n      <div className=\\\"flex flex-col gap-6\\\">\\n        <div>\\n          <Typography variant=\\\"body\\\" className=\\\"font-bold mb-2\\\">Select Tier</Typography>\\n          <Select \\n            value={plan} \\n            onChange={(e) => setPlan(e.target.value)}\\n            options={[\\n              { value: \\\"basic\\\", label: \\\"Basic ($10/mo)\\\" },\\n              { value: \\\"pro\\\", label: \\\"Pro ($20/mo)\\\" },\\n              { value: \\\"enterprise\\\", label: \\\"Enterprise ($50/mo)\\\" }\\n            ]}\\n          />\\n        </div>\\n        \\n        <div>\\n          <div className=\\\"flex justify-between mb-2\\\">\\n            <Typography variant=\\\"body\\\" className=\\\"font-bold\\\">Team Size</Typography>\\n            <Badge>{users} users</Badge>\\n          </div>\\n          <Slider value={users} onChange={(e) => setUsers(Number(e.target.value))} min={1} max={50} />\\n        </div>\\n        \\n        <div className=\\\"flex justify-between items-center bg-slate-50 p-4 rounded-lg\\\">\\n          <Typography variant=\\\"body\\\" className=\\\"font-bold\\\">Annual Billing (20% off)</Typography>\\n          <Toggle checked={annual} onChange={setAnnual} />\\n        </div>\\n      </div>\\n      \\n      <div className=\\\"mt-auto border-t border-slate-200 pt-4\\\">\\n        <div className=\\\"flex justify-between items-end mb-4\\\">\\n          <Typography variant=\\\"body\\\" className=\\\"text-slate-500\\\">Estimated Total</Typography>\\n          <Typography variant=\\\"h2\\\" className=\\\"font-bold text-3xl text-blue-600\\\">${total}<span className=\\\"text-sm text-slate-500\\\">/mo</span></Typography>\\n        </div>\\n        <Button variant=\\\"primary\\\" className=\\\"w-full\\\">Proceed to Checkout</Button>\\n      </div>\\n    </div>\\n  );\\n}\\nrender(<Checkout />);\"\n    }\n  ]\n}",
  "mermaid": ""
},
  {
  "id": "hybrid_live_data",
  "title": "Live API Weather (Hybrid)",
  "description": "Fetches live data from a public API using useDataFetch.",
  "promptHint": "A live data widget fetching from an external API via useDataFetch.",
  "diagramType": "freeform",
  "source": "{\n  \"version\": 1,\n  \"shapes\": [\n    {\n      \"id\": \"ui4\",\n      \"type\": \"ui_node\",\n      \"x\": 100,\n      \"y\": 100,\n      \"width\": 400,\n      \"height\": 350,\n      \"code\": \"function LiveWeatherWidget() {\\n  const { data, loading, error } = useDataFetch(\\\"https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m\\\");\\n  \\n  if (loading) return <div className=\\\"p-6 flex justify-center items-center h-full w-full text-slate-500\\\">Loading live data...</div>;\\n  if (error) return <div className=\\\"p-6 text-red-500\\\">Error loading data.</div>;\\n\\n  const currentTemp = data?.current?.temperature_2m;\\n  const windSpeed = data?.current?.wind_speed_10m;\\n  const hourlyTemps = data?.hourly?.temperature_2m?.slice(0, 10) || [];\\n\\n  return (\\n    <Card className=\\\"w-full h-full flex flex-col bg-gradient-to-br from-blue-500 to-cyan-400 text-white border-0 shadow-lg font-sans\\\">\\n      <div className=\\\"flex justify-between items-start mb-6\\\">\\n        <div>\\n          <Typography variant=\\\"h3\\\" className=\\\"font-bold text-white mb-1\\\">San Francisco</Typography>\\n          <Typography variant=\\\"body\\\" className=\\\"opacity-80\\\">Live API Data</Typography>\\n        </div>\\n        <Badge className=\\\"bg-white/20 text-white border-0 backdrop-blur-sm\\\">Live</Badge>\\n      </div>\\n      \\n      <div className=\\\"flex items-center gap-6 mb-8\\\">\\n        <div className=\\\"text-6xl font-bold\\\">{currentTemp}°C</div>\\n        <div className=\\\"flex flex-col gap-1 opacity-90 text-sm\\\">\\n          <div>Wind: {windSpeed} km/h</div>\\n          <div>Precipitation: 0%</div>\\n        </div>\\n      </div>\\n      \\n      <div className=\\\"mt-auto h-24 bg-white/10 p-3 rounded-lg backdrop-blur-sm\\\">\\n        <Typography variant=\\\"body\\\" className=\\\"text-xs font-bold mb-2 opacity-80 uppercase tracking-wider\\\">24h Forecast</Typography>\\n        <LineChart data={hourlyTemps} color=\\\"#ffffff\\\" />\\n      </div>\\n    </Card>\\n  );\\n}\\nrender(<LiveWeatherWidget />);\"\n    }\n  ]\n}",
  "mermaid": ""
},
  {
  "id": "hybrid_shared_kanban",
  "title": "Multiplayer Kanban (Hybrid)",
  "description": "A Yjs-synced kanban board using useSharedState.",
  "promptHint": "A multiplayer kanban board using useSharedState.",
  "diagramType": "freeform",
  "source": "{\n  \"version\": 1,\n  \"shapes\": [\n    {\n      \"id\": \"ui5\",\n      \"type\": \"ui_node\",\n      \"x\": 50,\n      \"y\": 50,\n      \"width\": 700,\n      \"height\": 450,\n      \"code\": \"function SharedKanban() {\\n  const [tasks, setTasks] = useSharedState(\\\"kanban_tasks\\\", [\\n    { id: 1, title: \\\"Design System\\\", status: \\\"todo\\\" },\\n    { id: 2, title: \\\"Auth Flow\\\", status: \\\"doing\\\" },\\n    { id: 3, title: \\\"Landing Page\\\", status: \\\"done\\\" }\\n  ]);\\n  \\n  const moveTask = (id, newStatus) => {\\n    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));\\n  };\\n\\n  const Column = ({ title, status }) => (\\n    <div className=\\\"flex-1 bg-slate-100 rounded-lg p-3 flex flex-col gap-3 min-h-[300px]\\\">\\n      <Typography variant=\\\"body\\\" className=\\\"font-bold text-slate-700 uppercase text-xs tracking-wider mb-1\\\">{title}</Typography>\\n      {tasks.filter(t => t.status === status).map(t => (\\n        <Card key={t.id} className=\\\"p-3 shadow-sm border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group\\\">\\n          <Typography variant=\\\"body\\\" className=\\\"font-medium text-sm mb-3\\\">{t.title}</Typography>\\n          <div className=\\\"flex justify-between opacity-0 group-hover:opacity-100 transition-opacity\\\">\\n            {status !== 'todo' ? <button onClick={() => moveTask(t.id, status === 'done' ? 'doing' : 'todo')} className=\\\"text-xs text-slate-500 hover:text-blue-600\\\">←</button> : <div></div>}\\n            {status !== 'done' ? <button onClick={() => moveTask(t.id, status === 'todo' ? 'doing' : 'done')} className=\\\"text-xs text-slate-500 hover:text-blue-600\\\">→</button> : <div></div>}\\n          </div>\\n        </Card>\\n      ))}\\n    </div>\\n  );\\n\\n  return (\\n    <div className=\\\"w-full h-full flex flex-col bg-white p-4 font-sans\\\">\\n      <div className=\\\"flex justify-between items-center mb-6\\\">\\n        <Typography variant=\\\"h4\\\" className=\\\"font-bold\\\">Multiplayer Kanban</Typography>\\n        <Badge variant=\\\"warning\\\">Yjs Synced</Badge>\\n      </div>\\n      \\n      <div className=\\\"flex gap-4 flex-1\\\">\\n        <Column title=\\\"To Do\\\" status=\\\"todo\\\" />\\n        <Column title=\\\"In Progress\\\" status=\\\"doing\\\" />\\n        <Column title=\\\"Done\\\" status=\\\"done\\\" />\\n      </div>\\n    </div>\\n  );\\n}\\nrender(<SharedKanban />);\"\n    }\n  ]\n}",
  "mermaid": ""
}
];

export const ALL_TEMPLATES: FlowchartTemplate[] = TEMPLATES;

export function getTemplate(id: string): FlowchartTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateSource(t: FlowchartTemplate): string {
  return t.source ?? t.mermaid;
}

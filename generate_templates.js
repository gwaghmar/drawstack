const fs = require('fs');

let content = fs.readFileSync('packages/core/src/templates.ts', 'utf8');

const t1_code = "function Dashboard() {\n" +
"  const [activeTab, setActiveTab] = useState(\"Overview\");\n" +
"  \n" +
"  return (\n" +
"    <div className=\"flex flex-col h-full w-full bg-slate-50 text-slate-900 p-4 font-sans\">\n" +
"      <div className=\"flex justify-between items-center mb-6\">\n" +
"        <Typography variant=\"h3\" className=\"font-bold\">SaaS Metrics</Typography>\n" +
"        <Badge variant=\"success\">Live System</Badge>\n" +
"      </div>\n" +
"      \n" +
"      <Tabs tabs={[\"Overview\", \"Analytics\", \"Reports\"]} activeTab={activeTab} onChange={setActiveTab} className=\"mb-6\" />\n" +
"      \n" +
"      {activeTab === \"Overview\" && (\n" +
"        <div className=\"flex flex-col gap-4\">\n" +
"          <div className=\"grid grid-cols-2 gap-4\">\n" +
"            <Card>\n" +
"              <Typography variant=\"h4\" className=\"font-bold text-2xl mb-1\">$45.2k</Typography>\n" +
"              <Typography variant=\"body\" className=\"text-slate-500\">MRR (+12%)</Typography>\n" +
"            </Card>\n" +
"            <Card>\n" +
"              <Typography variant=\"h4\" className=\"font-bold text-2xl mb-1\">1,204</Typography>\n" +
"              <Typography variant=\"body\" className=\"text-slate-500\">Active Users</Typography>\n" +
"            </Card>\n" +
"          </div>\n" +
"          \n" +
"          <Card className=\"h-48\">\n" +
"            <Typography variant=\"body\" className=\"font-bold mb-2\">Revenue Growth</Typography>\n" +
"            <BarChart data={[12, 19, 15, 22, 28, 35]} />\n" +
"          </Card>\n" +
"        </div>\n" +
"      )}\n" +
"      \n" +
"      {activeTab === \"Analytics\" && (\n" +
"        <Card className=\"h-64 flex flex-col items-center justify-center\">\n" +
"          <Typography variant=\"body\" className=\"font-bold mb-4\">User Demographics</Typography>\n" +
"          <div className=\"h-40 w-40\">\n" +
"            <DonutChart data={[40, 30, 20, 10]} />\n" +
"          </div>\n" +
"        </Card>\n" +
"      )}\n" +
"      \n" +
"      {activeTab === \"Reports\" && (\n" +
"        <Card className=\"flex-1 overflow-auto p-2\">\n" +
"          <DataTable \n" +
"            headers={[\"Invoice\", \"Amount\", \"Status\"]} \n" +
"            rows={[\n" +
"              [\"INV-001\", \"$120.00\", \"Paid\"],\n" +
"              [\"INV-002\", \"$250.00\", \"Pending\"],\n" +
"              [\"INV-003\", \"$99.00\", \"Paid\"],\n" +
"            ]} \n" +
"          />\n" +
"        </Card>\n" +
"      )}\n" +
"    </div>\n" +
"  );\n" +
"}\n" +
"render(<Dashboard />);\n";

const t2_code = "function LiveChat() {\n" +
"  const [messages, setMessages] = useSharedState(\"chat_msgs\", [\n" +
"    { sender: \"System\", text: \"Welcome to the chat!\" }\n" +
"  ]);\n" +
"  const [input, setInput] = useState(\"\");\n" +
"  \n" +
"  const handleSend = () => {\n" +
"    if (!input.trim()) return;\n" +
"    setMessages([...messages, { sender: \"User\", text: input }]);\n" +
"    setInput(\"\");\n" +
"  };\n" +
"\n" +
"  return (\n" +
"    <div className=\"flex flex-col h-full w-full bg-white border border-slate-200 rounded-lg shadow-sm font-sans\">\n" +
"      <div className=\"bg-slate-800 text-white p-3 font-bold text-sm\">\n" +
"        Team Sync (Multiplayer)\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"flex-1 overflow-auto p-4 flex flex-col gap-3 bg-slate-50\">\n" +
"        {messages.map((m, i) => (\n" +
"          <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.sender === 'User' ? 'bg-blue-500 text-white self-end' : 'bg-white border border-slate-200 text-slate-800 self-start'}`}>\n" +
"            <div className=\"text-xs opacity-70 mb-1 font-bold\">{m.sender}</div>\n" +
"            <div className=\"text-sm\">{m.text}</div>\n" +
"          </div>\n" +
"        ))}\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"p-3 bg-white border-t border-slate-200 flex gap-2\">\n" +
"        <Input \n" +
"          value={input} \n" +
"          onChange={(e) => setInput(e.target.value)} \n" +
"          placeholder=\"Type a message...\" \n" +
"          onKeyDown={(e) => e.key === 'Enter' && handleSend()}\n" +
"        />\n" +
"        <Button onClick={handleSend} variant=\"primary\">Send</Button>\n" +
"      </div>\n" +
"    </div>\n" +
"  );\n" +
"}\n" +
"render(<LiveChat />);\n";

const t3_code = "function Checkout() {\n" +
"  const [plan, setPlan] = useState(\"pro\");\n" +
"  const [users, setUsers] = useState(5);\n" +
"  const [annual, setAnnual] = useState(true);\n" +
"  \n" +
"  const basePrice = plan === \"pro\" ? 20 : (plan === \"enterprise\" ? 50 : 10);\n" +
"  const multiplier = annual ? 0.8 : 1;\n" +
"  const total = Math.round(basePrice * users * multiplier);\n" +
"\n" +
"  return (\n" +
"    <div className=\"p-6 bg-white w-full h-full flex flex-col font-sans\">\n" +
"      <Typography variant=\"h3\" className=\"font-bold mb-4\">Pricing Calculator</Typography>\n" +
"      \n" +
"      <div className=\"flex flex-col gap-6\">\n" +
"        <div>\n" +
"          <Typography variant=\"body\" className=\"font-bold mb-2\">Select Tier</Typography>\n" +
"          <Select \n" +
"            value={plan} \n" +
"            onChange={(e) => setPlan(e.target.value)}\n" +
"            options={[\n" +
"              { value: \"basic\", label: \"Basic ($10/mo)\" },\n" +
"              { value: \"pro\", label: \"Pro ($20/mo)\" },\n" +
"              { value: \"enterprise\", label: \"Enterprise ($50/mo)\" }\n" +
"            ]}\n" +
"          />\n" +
"        </div>\n" +
"        \n" +
"        <div>\n" +
"          <div className=\"flex justify-between mb-2\">\n" +
"            <Typography variant=\"body\" className=\"font-bold\">Team Size</Typography>\n" +
"            <Badge>{users} users</Badge>\n" +
"          </div>\n" +
"          <Slider value={users} onChange={(e) => setUsers(Number(e.target.value))} min={1} max={50} />\n" +
"        </div>\n" +
"        \n" +
"        <div className=\"flex justify-between items-center bg-slate-50 p-4 rounded-lg\">\n" +
"          <Typography variant=\"body\" className=\"font-bold\">Annual Billing (20% off)</Typography>\n" +
"          <Toggle checked={annual} onChange={setAnnual} />\n" +
"        </div>\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"mt-auto border-t border-slate-200 pt-4\">\n" +
"        <div className=\"flex justify-between items-end mb-4\">\n" +
"          <Typography variant=\"body\" className=\"text-slate-500\">Estimated Total</Typography>\n" +
"          <Typography variant=\"h2\" className=\"font-bold text-3xl text-blue-600\">${total}<span className=\"text-sm text-slate-500\">/mo</span></Typography>\n" +
"        </div>\n" +
"        <Button variant=\"primary\" className=\"w-full\">Proceed to Checkout</Button>\n" +
"      </div>\n" +
"    </div>\n" +
"  );\n" +
"}\n" +
"render(<Checkout />);\n";

const t4_code = "function LiveWeatherWidget() {\n" +
"  const { data, loading, error } = useDataFetch(\"https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m\");\n" +
"  \n" +
"  if (loading) return <div className=\"p-6 flex justify-center items-center h-full w-full text-slate-500\">Loading live data...</div>;\n" +
"  if (error) return <div className=\"p-6 text-red-500\">Error loading data.</div>;\n" +
"\n" +
"  const currentTemp = data?.current?.temperature_2m;\n" +
"  const windSpeed = data?.current?.wind_speed_10m;\n" +
"  const hourlyTemps = data?.hourly?.temperature_2m?.slice(0, 10) || [];\n" +
"\n" +
"  return (\n" +
"    <Card className=\"w-full h-full flex flex-col bg-gradient-to-br from-blue-500 to-cyan-400 text-white border-0 shadow-lg font-sans\">\n" +
"      <div className=\"flex justify-between items-start mb-6\">\n" +
"        <div>\n" +
"          <Typography variant=\"h3\" className=\"font-bold text-white mb-1\">San Francisco</Typography>\n" +
"          <Typography variant=\"body\" className=\"opacity-80\">Live API Data</Typography>\n" +
"        </div>\n" +
"        <Badge className=\"bg-white/20 text-white border-0 backdrop-blur-sm\">Live</Badge>\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"flex items-center gap-6 mb-8\">\n" +
"        <div className=\"text-6xl font-bold\">{currentTemp}°C</div>\n" +
"        <div className=\"flex flex-col gap-1 opacity-90 text-sm\">\n" +
"          <div>Wind: {windSpeed} km/h</div>\n" +
"          <div>Precipitation: 0%</div>\n" +
"        </div>\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"mt-auto h-24 bg-white/10 p-3 rounded-lg backdrop-blur-sm\">\n" +
"        <Typography variant=\"body\" className=\"text-xs font-bold mb-2 opacity-80 uppercase tracking-wider\">24h Forecast</Typography>\n" +
"        <LineChart data={hourlyTemps} color=\"#ffffff\" />\n" +
"      </div>\n" +
"    </Card>\n" +
"  );\n" +
"}\n" +
"render(<LiveWeatherWidget />);\n";

const t5_code = "function SharedKanban() {\n" +
"  const [tasks, setTasks] = useSharedState(\"kanban_tasks\", [\n" +
"    { id: 1, title: \"Design System\", status: \"todo\" },\n" +
"    { id: 2, title: \"Auth Flow\", status: \"doing\" },\n" +
"    { id: 3, title: \"Landing Page\", status: \"done\" }\n" +
"  ]);\n" +
"  \n" +
"  const moveTask = (id, newStatus) => {\n" +
"    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));\n" +
"  };\n" +
"\n" +
"  const Column = ({ title, status }) => (\n" +
"    <div className=\"flex-1 bg-slate-100 rounded-lg p-3 flex flex-col gap-3 min-h-[300px]\">\n" +
"      <Typography variant=\"body\" className=\"font-bold text-slate-700 uppercase text-xs tracking-wider mb-1\">{title}</Typography>\n" +
"      {tasks.filter(t => t.status === status).map(t => (\n" +
"        <Card key={t.id} className=\"p-3 shadow-sm border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group\">\n" +
"          <Typography variant=\"body\" className=\"font-medium text-sm mb-3\">{t.title}</Typography>\n" +
"          <div className=\"flex justify-between opacity-0 group-hover:opacity-100 transition-opacity\">\n" +
"            {status !== 'todo' ? <button onClick={() => moveTask(t.id, status === 'done' ? 'doing' : 'todo')} className=\"text-xs text-slate-500 hover:text-blue-600\">←</button> : <div></div>}\n" +
"            {status !== 'done' ? <button onClick={() => moveTask(t.id, status === 'todo' ? 'doing' : 'done')} className=\"text-xs text-slate-500 hover:text-blue-600\">→</button> : <div></div>}\n" +
"          </div>\n" +
"        </Card>\n" +
"      ))}\n" +
"    </div>\n" +
"  );\n" +
"\n" +
"  return (\n" +
"    <div className=\"w-full h-full flex flex-col bg-white p-4 font-sans\">\n" +
"      <div className=\"flex justify-between items-center mb-6\">\n" +
"        <Typography variant=\"h4\" className=\"font-bold\">Multiplayer Kanban</Typography>\n" +
"        <Badge variant=\"warning\">Yjs Synced</Badge>\n" +
"      </div>\n" +
"      \n" +
"      <div className=\"flex gap-4 flex-1\">\n" +
"        <Column title=\"To Do\" status=\"todo\" />\n" +
"        <Column title=\"In Progress\" status=\"doing\" />\n" +
"        <Column title=\"Done\" status=\"done\" />\n" +
"      </div>\n" +
"    </div>\n" +
"  );\n" +
"}\n" +
"render(<SharedKanban />);\n";

const newTemplates = [
  {
    id: "hybrid_saas_dashboard",
    title: "SaaS Dashboard Widget (Hybrid)",
    description: "An interactive React dashboard powered by ui_node.",
    promptHint: "A live interactive SaaS dashboard using ui_node with tabs and charts.",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ui1", type: "ui_node", x: 100, y: 100, width: 400, height: 500, code: t1_code.trim() }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "hybrid_live_chat",
    title: "Multiplayer Live Chat (Hybrid)",
    description: "Real-time collaborative chat using useSharedState.",
    promptHint: "A multiplayer live chat interface using useSharedState in ui_node.",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ui2", type: "ui_node", x: 100, y: 100, width: 350, height: 450, code: t2_code.trim() }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "hybrid_ecommerce_checkout",
    title: "Dynamic Checkout (Hybrid)",
    description: "A pricing calculator using Select, Slider, and Toggle.",
    promptHint: "A dynamic SaaS pricing calculator using ui_node.",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ui3", type: "ui_node", x: 100, y: 100, width: 400, height: 480, code: t3_code.trim() }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "hybrid_live_data",
    title: "Live API Weather (Hybrid)",
    description: "Fetches live data from a public API using useDataFetch.",
    promptHint: "A live data widget fetching from an external API via useDataFetch.",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ui4", type: "ui_node", x: 100, y: 100, width: 400, height: 350, code: t4_code.trim() }
      ]
    }, null, 2),
    mermaid: "",
  },
  {
    id: "hybrid_shared_kanban",
    title: "Multiplayer Kanban (Hybrid)",
    description: "A Yjs-synced kanban board using useSharedState.",
    promptHint: "A multiplayer kanban board using useSharedState.",
    diagramType: "freeform",
    source: JSON.stringify({
      version: 1,
      shapes: [
        { id: "ui5", type: "ui_node", x: 50, y: 50, width: 700, height: 450, code: t5_code.trim() }
      ]
    }, null, 2),
    mermaid: "",
  }
];

const arrayStr = ",\n" + newTemplates.map(t => "  " + JSON.stringify(t, null, 2)).join(",\n") + "\n];\n\n";

content = content.replace("];\n\nexport const ALL_TEMPLATES", arrayStr + "export const ALL_TEMPLATES");

fs.writeFileSync('packages/core/src/templates.ts', content, 'utf8');
console.log("Templates added successfully.");

const fs = require('fs');

// Patch generate/route.ts
let generateRoute = fs.readFileSync('apps/web/app/api/ai/generate/route.ts', 'utf8');

generateRoute = generateRoute.replace(
  '  clarificationQuestion?: string;',
  '  clarificationQuestion?: string;\n  requiredComponents?: string[];'
);

generateRoute = generateRoute.replace(
  '      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo.map(String).slice(0, 5) : [],',
  '      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo.map(String).slice(0, 5) : [],\n      requiredComponents: Array.isArray(parsed.requiredComponents) ? parsed.requiredComponents.map(String) : [],'
);

generateRoute = generateRoute.replace(
  '      missingInfo: [],',
  '      missingInfo: [],\n      requiredComponents: [],'
);

generateRoute = generateRoute.replace(
  '  "missingInfo": ["array of what critical structure is completely missing, or empty"]',
  '  "missingInfo": ["array of what critical structure is completely missing, or empty"],\n  "requiredComponents": ["Button", "Card", "LineChart", "Form"] // list of injected UI components needed'
);

generateRoute = generateRoute.replace(
  'let finalSystemPrompt = DIAGRAM_SYSTEM_PROMPTS[effectiveDiagramType];',
  `let finalSystemPrompt = DIAGRAM_SYSTEM_PROMPTS[effectiveDiagramType];
    if (intentPlan.requiredComponents && intentPlan.requiredComponents.length > 0) {
      finalSystemPrompt = finalSystemPrompt.replace(
        "CRITICAL RULES FOR UI NODES:",
        "CRITICAL RULES FOR UI NODES:\\n     - ONLY use these required components: " + intentPlan.requiredComponents.join(", ") + ". Do NOT use other complex components to save tokens."
      );
    }`
);

fs.writeFileSync('apps/web/app/api/ai/generate/route.ts', generateRoute, 'utf8');

// Patch diagram-types.ts
let diagramTypes = fs.readFileSync('packages/core/src/diagram-types.ts', 'utf8');

diagramTypes = diagramTypes.replace(
  "- \\`<DataTable columns={['ID', 'Name']} data={[['1', 'Alice'], ['2', 'Bob']]} />\\`",
  `- \\`<DataTable columns={['ID', 'Name']} data={[['1', 'Alice'], ['2', 'Bob']]} />\\`
       - \\`<Form onSubmit={(e)=>...}>\\`, \\`<Slider value={0} onChange={(e)=>...}>\\`, \\`<Toggle checked={false} onChange={(v)=>...}>\\`, \\`<Select options={[{label:'A',value:'A'}]} />\\``
);

diagramTypes = diagramTypes.replace(
  "- **State & Hooks:** You CAN use \\`useState\\`, \\`useEffect\\`, \\`useMemo\\`, and \\`useCallback\\`. They are injected globally. Create interactive prototypes!",
  `- **State & Hooks:** You CAN use \\`useState\\`, \\`useEffect\\`, \\`useMemo\\`, and \\`useCallback\\`. 
       - **Multiplayer/Sync:** Use \\`const [val, setVal] = useSharedState('myKey', initialVal)\\` to sync state across all users in the room.
       - **Live Data:** Use \\`const { data, loading, error } = useDataFetch('https://api.example.com/data')\\` to pull real-time data securely.`
);

fs.writeFileSync('packages/core/src/diagram-types.ts', diagramTypes, 'utf8');
console.log("Patched successfully");

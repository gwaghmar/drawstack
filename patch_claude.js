const fs = require('fs');
let file = fs.readFileSync('CLAUDE.md', 'utf8');

const additions = `
### Hybrid Engine + 5 Epic Additions (2026-08-18)
The Freeform Canvas engine has been upgraded to a **Hybrid Engine**, seamlessly blending static vector shapes with fully functional, injected React UI components.
1. **Forms Primitives**: Native, theme-aware, injected primitives like \`Form\`, \`Slider\`, \`Toggle\`, and \`Select\` have been added to the \`ui_node\` scope, enabling AI-generated data-dense interactive prototypes directly on the canvas.
2. **UseDataFetch Hook**: A custom \`useDataFetch(url)\` hook injected into the sandbox, allowing interactive UI elements to fetch real, live data from public APIs.
3. **UseSharedState (Yjs)**: A \`useSharedState(key, initial)\` hook backed by Yjs \`sharedState\`. This turns any isolated prototype on the canvas into a real-time multiplayer application instantly synced across clients.
4. **Token Pre-Flight Optimization**: The \`generate\` API route implements intent-based pre-flight. It analyzes the user's prompt via the intent planner, determines which components the diagram will need, and surgically prunes the injected system prompt catalog to save up to 10% in generation tokens.
5. **Self-Healing LLM Loop**: React runtime errors inside the \`LiveProvider\` sandbox (e.g. from generated React code) are caught automatically, bundled with the offending code, and shipped to a dedicated \`/api/ai/repair-node\` endpoint. The LLM fixes the code, and the canvas instantly patches the node via \`commitChanges\` without the user ever clicking "repair".

`;

file = file.replace(
  '### Render paths — now unified (was a real bug, now fixed)',
  additions + '### Render paths — now unified (was a real bug, now fixed)'
);

fs.writeFileSync('CLAUDE.md', file, 'utf8');
console.log("Updated CLAUDE.md");

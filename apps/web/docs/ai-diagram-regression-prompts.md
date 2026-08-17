## AI Diagram Regression Prompts

Use this checklist to manually validate that generation quality is coherent for low-context and high-detail prompts across all diagram types.

### Mermaid
- Low context: `build a user signup flow`
- High detail: `Create a left-to-right flowchart for signup with email verification, weak-password branch, rate limit branch, retry, and success metrics logging.`

### Excalidraw
- Low context: `customer support process`
- High detail: `Sketch a whiteboard of support triage: intake, categorization, priority queue, escalation path, SLA timers, and resolution feedback loop.`

### React Flow
- Low context: `data pipeline`
- High detail: `Build a node graph for ETL: source connectors, validation, deduplication, enrichment, warehouse load, and monitoring alerts with failure path.`

### ECharts
- Low context: `monthly sales chart`
- High detail: `Create a comparative chart with monthly sales vs returns for 2024 and 2025 including trend readability and clean legend labels.`

### Nivo
- Low context: `team velocity`
- High detail: `Generate a bar chart dataset for team velocity by sprint for 3 squads with points committed vs completed and readable labels.`

### Freeform Canvas
- Low context: `project kickoff board`
- High detail: `Create a freeform canvas board with a frame, three named boxes for research, design, and build connected in order, and a sticky note reminder.`

### BPMN
- Low context: `purchase approval process`
- High detail: `Create BPMN for purchase approval with requester, manager approval, finance approval over threshold, rejection path, and final procurement task.`

## Pass Criteria
- Diagram reflects intent and avoids random filler nodes.
- Short prompt returns a compact but complete structure.
- Detailed prompt expands branches/annotations meaningfully.
- Output parses and renders without manual fixes.
- If ambiguity is too high, assistant asks one concise clarifying question.

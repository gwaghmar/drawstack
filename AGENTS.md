# AGENTS.md

Instructions for any AI coding agent working in this repository (Antigravity, Cursor,
Aider, Claude Code, Gemini CLI, Copilot, etc.). This is the tool-agnostic source of
truth — `CLAUDE.md` and `GEMINI.md` exist for tool-specific conventions but should
never contradict this file. If they do, this file wins; fix the other one.

## What this is

**drawstack** (also referenced as FlowStudio/drawxyz in older docs and commit
history — one product, several names in circulation) — an AI-powered diagram editor.
Plain-text prompt in → rendered diagram out. Solo-founder project, aimed at solo
creators who need diagrams for decks, docs, social posts, and embeds.

Live: https://drawxyz.vercel.app · Repo: https://github.com/gwaghmar/drawstack

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- Drizzle ORM on Postgres (Neon via `DATABASE_URL`)
- Vercel AI SDK v6 — multi-provider (OpenAI / Anthropic / Google / Groq / Mistral / OpenRouter)
- Auth.js (Supabase) — mock-auth mode for local dev (`MOCK_DB=true`)
- Stripe billing (checkout, portal, webhook)
- pnpm monorepo: `apps/web` (Next app) + `packages/core` (shared types/prompts) +
  `packages/cli` + `packages/mcp-server`
- Mermaid, Excalidraw, ReactFlow (@xyflow), ECharts, Nivo, tldraw, bpmn-js, Konva —
  22 diagram types total, see `packages/core/src/diagram-types.ts`

## Commands

```bash
pnpm install
pnpm --filter @flowchart/web dev              # dev server, :3040
pnpm --filter @flowchart/web exec tsc --noEmit  # type-check — do after every change
pnpm --filter @flowchart/web build            # production build — catches what tsc misses
pnpm test:unit                                # node --test, ~15 suites, no framework
pnpm exec playwright test --grep "<name>"     # single e2e test
pnpm --filter @flowchart/web db:push          # apply schema to Postgres (needs DATABASE_URL)
```

## Architecture, in one paragraph

`apps/web/components/editor-client.tsx` is the single large editor component —
holds all state (source, theme, undo/redo, AI chat), branches on `diagramType` to
pick a renderer. Each diagram type has a renderer in
`apps/web/components/diagrams/*-renderer.tsx` with the contract
`{ source: string, onChange?: (s: string) => void, readOnly?: boolean }`. AI
generation goes through `apps/web/app/api/ai/generate/route.ts` (two-pass:
intent → generation) or `apps/web/app/api/ai/agent/route.ts` (Agent Mode, tool
calls). `packages/core/src/diagram-types.ts` holds `DIAGRAM_SYSTEM_PROMPTS` — one
prompt per diagram type. Output is validated/repaired by
`apps/web/lib/diagrams/validate-output.ts` before it reaches the editor.

## Conventions

- **No comments explaining what code does** — only WHY when genuinely non-obvious.
- No multi-line docstrings. No emojis in code or commits unless asked.
- No backwards-compat shims, no defensive validation for cases that can't happen —
  trust internal callers.
- Commits: `feat(scope): subject` / `fix(scope): subject` / `chore(scope): subject`,
  body explains why. Work directly on `master` (explicitly authorized by the owner)
  — this is a solo project, no PR review gate.
- `DIAGRAM_SYSTEM_PROMPTS` / intent-pipeline changes must not break existing saved
  projects. The intent-planning LLM call must stay ≤2s — no added sequential calls.
- Preview canvas must always match the export exactly (WYSIWYG is the core value).

## In progress: agent-native freeform canvas (replacing tldraw)

tldraw's license requires a paid commercial agreement for production/commercial
use, which this product needs before it can sell subscriptions. Under active build:
a custom JSON-scene-graph canvas (Konva-rendered) that both humans (drag-to-edit)
and AI agents (id/name-addressed patch operations) edit as the same document —
no translation layer between what the AI writes and what the human sees.

**Full plan, current status, and exact next steps: `docs/planning/freeform-canvas-engine-plan.md`
— read the "STATUS" section at the top of the build order before touching this
area.** It records what's done, what's tested, what's still open, and several
hard-won implementation rules (Konva gesture state must live in refs, not React
state; Transformer scale must be baked into width/height, never stored, etc.) —
don't relearn these by re-breaking them.

As of the last update: the schema, ops engine, model-facing AI serialization, full
renderer, and AI generation/agent-tool wiring are built and committed; the type is
reachable in the app. Read the STATUS section for exactly what's pushed vs. local,
and what verification remains before tldraw itself gets removed.

## Things not to do

- Don't merge `claude/loving-brown-MphvU` — dead branch, fully superseded on master.
- Don't add CodeMirror/Monaco for the source editor — the zero-dep highlighter is intentional.
- Don't rebuild canvas drawing primitives (resize handles, hit-testing) from scratch —
  Excalidraw (MIT) and Konva already solve that; only the ops/schema layer is novel here.
- Don't assume the production revenue funnel (signup → generate → checkout) works —
  it has not been end-to-end tested since a database migration; verify before relying on it.

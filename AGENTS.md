# AGENTS.md

Instructions for any AI coding agent working in this repository (Antigravity, Cursor,
Aider, Claude Code, Gemini CLI, Copilot, etc.). This is the tool-agnostic source of
truth — `CLAUDE.md` and `GEMINI.md` exist for tool-specific conventions but should
never contradict this file. If they do, this file wins; fix the other one.

## What this is

**drawstack** (also referenced as FlowStudio/drawxyz in older docs and commit
history — one product, several names in circulation) — an AI-powered diagram editor.
One prompt in → a fully editable visual canvas out. Solo-founder project, aimed at solo
creators who need diagrams for decks, docs, social posts, and embeds.

Live: https://drawxyz.vercel.app · Repo: https://github.com/gwaghmar/drawstack

**As of 2026-08-17, this is a single-engine product.** Every diagram type other than the
custom freeform canvas — Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, BPMN, cloud/ERD/
orgchart, D3, Cytoscape, vis-network, Fabric, PixiJS, and all 12 social-card types — was
deliberately, fully deleted (renderers, prompts, validators, share/embed wiring,
templates). `DiagramType` is a single-member union now. This was user-directed; don't
restore any of it without being asked. Full backup at git tag/branch
`all-27-diagram-types` / `backup/all-27-diagram-types` if something needs recovering.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- Drizzle ORM on Postgres (Neon via `DATABASE_URL`)
- Vercel AI SDK v6 — multi-provider (OpenAI / Anthropic / Google / Groq / Mistral / OpenRouter)
- Auth.js (Supabase) — mock-auth mode for local dev (`MOCK_DB=true`)
- Stripe billing (checkout, portal, webhook)
- pnpm monorepo: `apps/web` (Next app) + `packages/core` (shared types/prompts) +
  `packages/cli` + `packages/mcp-server`
- **The freeform canvas is the entire rendering stack**: Konva + roughjs (sketchy mode)
  + perfect-freehand (pen tool), all wrapped in self-built scene-graph code — not a
  collection of third-party diagram libraries. See `packages/core/src/diagram-types.ts`
  for the (single) `DiagramType` and the freeform system prompt.
- Yjs + y-webrtc multiplayer, now with a self-hosted WebSocket signaling server
  (`apps/web/app/api/yjs-signaling/route.ts`) instead of a public relay dependency.
- **Known dead weight, not yet pruned**: `mermaid`, `bpmn-js`, `d3`, `cytoscape`,
  `echarts`, `fabric`, `pixi.js`, `vis-network` are still listed in
  `apps/web/package.json` though nothing imports them post-pivot.

## Commands

```bash
pnpm install
pnpm --filter @flowchart/web dev              # dev server, :3040
pnpm --filter @flowchart/web exec tsc --noEmit  # type-check — do after every change
pnpm --filter @flowchart/web build            # production build — catches what tsc misses
pnpm test:unit                                # node --test, hand-maintained file list in package.json
pnpm exec playwright test --grep "<name>"     # single e2e test
pnpm --filter @flowchart/web db:push          # apply schema to Postgres (needs DATABASE_URL) — currently broken, see below
```

`db:push` (drizzle-kit push) crashes on a pre-existing bug introspecting this
database's RLS/CHECK constraints, before it reaches the actual diff. Use `db:generate`
to produce the migration SQL, read it, and apply a small reviewable statement directly
via the `postgres` driver if needed (see commit `90fe6ae` for the pattern).

Don't hardcode file/suite/test/type/template counts anywhere (docs, commit messages,
code, test assertions). A stale count has already caused two real bugs this session
after the underlying list changed and the number didn't.

## Architecture, in one paragraph

`apps/web/components/editor-client.tsx` is the single large editor component — holds all
state (source, theme, undo/redo, AI chat, multiplayer presence identity) and renders one
canvas: `apps/web/components/diagrams/freeform-renderer.tsx` (Konva). AI generation goes
through `apps/web/app/api/ai/generate/route.ts` (two-pass: intent → generation), Agent
Mode via `apps/web/app/api/ai/agent/route.ts` (tool calls incl. `apply_ops`), or the
public demo via `apps/web/app/api/ai/demo/route.ts`. `packages/core/src/diagram-types.ts`
holds the one remaining system prompt, `DIAGRAM_SYSTEM_PROMPTS.freeform`. Output is
validated/repaired by `apps/web/lib/diagrams/validate-output.ts` — **per-shape, not
all-or-nothing**: one truncated or malformed shape gets dropped (with reference cleanup
for anything that pointed at it), the rest of the AI's output survives. This validator
gates every generation surface and was hardened through 6 real production bugs on
2026-08-17, all found by testing against the real model rather than by inspection —
when touching it, verify the same way.

The engine renders through two paths that must agree (Konva for editing, `freeformToSvg`
for export) — they used to drift (macro shapes rendered in export but not on-canvas,
violating WYSIWYG) until Konva started rasterizing macro shapes by calling `freeformToSvg`
on them and drawing the result via `Konva.Image`. New macro shapes only need an export
branch, not two separate implementations — see CLAUDE.md's "Freeform canvas engine"
section for the full detail and the shape vocabulary (32 types).

## Conventions

- **No comments explaining what code does** — only WHY when genuinely non-obvious.
- No multi-line docstrings. No emojis in code or commits unless asked.
- No backwards-compat shims, no defensive validation for cases that can't happen —
  trust internal callers. (Exception: AI-output validation, where the caller is a
  language model and "impossible" cases are routine — see `validate-output.ts`.)
- Commits: `feat(scope): subject` / `fix(scope): subject` / `chore(scope): subject`,
  body explains why. Work directly on `master` (explicitly authorized by the owner)
  — this is a solo project, no PR review gate.
- `DIAGRAM_SYSTEM_PROMPTS.freeform` / intent-pipeline changes must not break existing
  saved projects. The intent-planning LLM call must stay ≤2s — no added sequential calls.
- Preview canvas must always match the export exactly (WYSIWYG is the core value) — see
  the render-path note above; this was a real, shipped violation until 2026-08-17.
- After deploying, verify the live site directly — don't trust the Vercel branch alias's
  "Ready" status alone. It has raced its own deployment target within a single session;
  cross-check the commit SHA on the deployment or use its unique URL directly.

## Freeform canvas engine

`tldraw` was removed early on to eliminate commercial licensing restrictions. In its
place: a custom JSON-scene-graph canvas (Konva-rendered) that both humans (drag-to-edit)
and AI agents (id/name-addressed patch operations via `apply_ops`) edit as the same
document — no translation layer between what the AI writes and what the human sees.
This is now the whole product, not one editing mode among several.

**Full plan, history, and deferred polish: `docs/planning/freeform-canvas-engine-plan.md`**
— predates the single-engine pivot and the 2026-08-17 macro-shape/validator work;
treat it as history (Milestones A–K, all complete), not the current ceiling. See
CLAUDE.md for the current shape vocabulary, render-path architecture, and hard-won
Konva implementation rules (gesture state in refs not React state, Transformer scale
baked into width/height, undo routing for hand-edits vs. remote Yjs edits, etc.).

## Things not to do

- Don't merge `claude/loving-brown-MphvU` — dead branch, fully superseded on master.
- Don't restore any of the deleted diagram types without being explicitly asked — see
  "What this is" above. Recover from the `all-27-diagram-types` tag/branch if needed.
- Don't add CodeMirror/Monaco for the source editor — the zero-dep highlighter is intentional.
- Don't rebuild canvas drawing primitives (resize handles, hit-testing) from scratch —
  Konva already solves that; only the ops/schema layer is novel here.
- Don't assume the production revenue funnel (signup → generate → checkout) works —
  it has not been end-to-end tested since a database migration; verify before relying on it.
- Don't hardcode a diagram-type/template/test count anywhere — describe things
  structurally instead (see Commands above).
- Don't assume you're the only agent touching this repo right now. Antigravity works
  here concurrently, often in the same session window — check `git status` /
  `git log --oneline -10` before assuming a dirty file or unexpected commit is stale or
  wrong, and diff what's actually staged before committing rather than trusting a broad
  `git add`.

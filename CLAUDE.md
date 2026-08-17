# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This captures the shape of the project, what's been built, and the conventions to follow. Update it as state changes.

---

## Commands

```bash
# Dev
pnpm --filter @flowchart/web dev          # start Next.js on :3040

# Type-check (do after every fix)
pnpm --filter @flowchart/web exec tsc --noEmit

# Build (catches issues tsc misses)
pnpm --filter @flowchart/web build

# Unit tests (node --test, no framework)
pnpm test:unit                            # all 13 suites

# Run a single test file
node --experimental-strip-types apps/web/lib/diagrams/social-cards.test.ts

# E2E (Playwright)
pnpm test                                 # full suite
pnpm exec playwright test --grep "pdf"   # filter by name

# DB
pnpm --filter @flowchart/web db:generate  # generate migration from schema changes
pnpm --filter @flowchart/web db:push      # apply to Supabase (requires DATABASE_URL)
pnpm --filter @flowchart/web db:studio    # Drizzle Studio UI
```

## What this is

**drawxyz** — an AI-powered diagram editor. Plain-text prompt in → rendered
diagram out. Aimed at solo creators (founders, indie hackers, technical writers)
who need diagrams for decks, blog posts, docs, social posts, and embeds.

URL: https://drawxyz.vercel.app

URL pattern: prompt → AI picks diagram type → editor renders → user iterates →
share / embed / export.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS
- **Drizzle ORM** on Postgres (Neon via `DATABASE_URL`)
- **Vercel AI SDK v6** (`ai`, `@ai-sdk/react`) — multi-provider (OpenAI / Anthropic / Google / Groq / Mistral / OpenRouter)
- **Auth.js** (Supabase) — mock-auth mode for local
- **Stripe** billing — checkout + portal routes under `app/api/billing/`, webhook at `app/api/webhooks/stripe/route.ts`, UI at `/app/billing`
- Monorepo (pnpm): `apps/web` (Next app) + `packages/core` (shared types, prompts, themes) + `packages/cli` + `packages/mcp-server` (root script `pnpm mcp:dev`)
- Mermaid + Excalidraw + ReactFlow (@xyflow) + ECharts + Nivo + bpmn-js + Konva (Freeform canvas) for diagram rendering

## Diagram types supported (22)

| Type | What it's for | Editing model |
|---|---|---|
| `mermaid` | Text grammar — flowchart, sequence, ER, gantt, mindmap, journey, pie, class, state (~13 subtypes) | source text |
| `excalidraw` | Whiteboard sketches | visual canvas + source |
| `reactflow` | Custom node graphs | drag-to-edit + source |
| `echarts` | Production charts | JSON source |
| `nivo` | Polished chart variants | JSON source (read-only) |
| `freeform` | Free-form whiteboard canvas — flat shape/arrow scene graph | visual canvas (Konva) + JSON source + AI ops |
| `bpmn` | BPMN 2.0 business process | visual modeler + XML source |
| `cloud` | AWS/GCP/Azure system & infra diagrams with service icons | drag-to-edit + source (xyflow) |
| `erd` | Visual database schema — table nodes with typed columns, PK/FK/UK, relationships | drag-to-edit + source (xyflow) |
| `orgchart` | Reporting hierarchy — person nodes (avatar/name/title) in a top-down tree | drag-to-edit + source (xyflow) |
| `timeline` | Milestone timelines | source + AI (social-json) |
| `versus` | Side-by-side comparison — X vs Y with pros, cons, and a verdict | source + AI (social-json) |
| `matrix2x2` | 2×2 quadrant charts — SWOT, effort vs impact | source + AI (social-json) |
| `funnel` | Conversion funnels — marketing/sales stages with numbers | source + AI (social-json) |
| `venn` | 2-set Venn overlap | source + AI (social-json) |
| `tierlist` | S/A/B/C tier rankings | source + AI (social-json) |
| `iceberg` | Layered depth diagrams (visible vs hidden) | source + AI (social-json) |
| `alignment` | 3×3 alignment chart grid | source + AI (social-json) |
| `budget` | Income/expense breakdown | source + AI (social-json) |
| `habits` | Monthly habit streak grid (GitHub-style) | source + AI (social-json) |
| `bingo` | 5×5 bingo card with labeled squares | source + AI (social-json) |
| `bracket` | Single-elimination tournament bracket | source + AI (social-json) |

The 12 `social-json` types all route through `social-card-renderer.tsx` (single dispatcher). Their AI output format is JSON validated by `parseSocialCard()` in `apps/web/lib/diagrams/social-cards.ts`.

All renderers live in `apps/web/components/diagrams/*-renderer.tsx`. The cloud, erd, and orgchart renderers (`cloud-renderer.tsx`, `erd-renderer.tsx`, `orgchart-renderer.tsx`) are the Group A xyflow family — all consume the shared helpers in `apps/web/lib/diagrams/` (`xyflow-base.ts` = parse/serialize/dagre-layout/change-handlers; `cloud-icons.ts`, `cloud-glyphs.tsx` = cloud-only icon registry). erd/orgchart need no icon registry — just a `TableNode` / `PersonNode`. NOTE: each Group A canvas render branch in `editor-client.tsx` MUST use `w-full` on the wrapper — the flex parent is `items-start justify-center`, so without an explicit width the xyflow canvas collapses to 0px and renders nothing. Editor is
`apps/web/components/editor-client.tsx` (one big file — every diagram type
branches inside its render section).

## Shipped: agent-native freeform canvas (replaced tldraw)

`tldraw` was removed to eliminate commercial licensing restrictions. In its place:
our custom JSON-scene-graph canvas (Konva-rendered) that both humans (drag-to-edit)
and AI agents (id/name-addressed patch operations via `apply_ops`) edit as the same document —
no translation layer between what the AI writes and what the human sees.

**Full plan, history, and deferred polish: `docs/planning/freeform-canvas-engine-plan.md`
— read the "STATUS" section at the top of the build order.**
Milestones A–K are complete, tested, and verified:
- `apps/web/lib/diagrams/freeform-canvas.ts` — scene-graph schema (`CanvasDocument`/
  `CanvasShape`) + pure functions (parse/serialize/resolveArrowEndpoint/validateRefs).
- `apps/web/lib/diagrams/freeform-ops.ts` — surgical patch ops engine (`applyCanvasOps`).
- `apps/web/lib/diagrams/freeform-serialization.ts` — compact model view serialization.
- `apps/web/components/diagrams/freeform-renderer.tsx` — Konva-based renderer with select,
  drag, snap, resize/rotate (`Konva.Transformer`), text-editing, arrow binding, frames,
  sticky notes, zoom/pan.
- `apps/web/app/api/ai/agent/route.ts` & `editor-client.tsx` — `apply_ops` tool integration.
  Pure-lib milestones (A–C) don't need it — they run on unit tests in this repo.

## Status — what's shipped

### Milestone 1.0 — AI Diagram Quality & Precision ✅
- WYSIWYG canvas (preview locks to export aspect ratio)
- Use-case awareness (AI infers presentation / social / docs / custom)
- Smarter AI generation (type-selection rules, ambiguityScore ≥ 90 to clarify, assumption banner)

### Milestone 1.1 — AI Iteration & Sharing ✅
- Surgical AI edits (`mode: "patch" | "create"`)
- Persistent version history (Clock icon dropdown, click to restore, history preserved)
- Public share + OG previews (`/s/[token]` page, branded 1200×630 og:image)

### Milestone 1.2 — Brand & Distribution ✅
- Brand kit (`brand_kit` table + Settings panel + Palette button)
- Iframe embeds (`/embed/[token]` chromeless viewer + copy `<iframe>` snippet)

### Milestone 1.3 — Legendary ✅
- **Real OG previews** — client captures a PNG at share-create time → stored on `share_link.preview_data_url` → og route serves the actual diagram
- **Streaming live preview** — Mermaid renders progressively as the AI types; `mermaid.parse()` gate + last-good-svg fallback prevents flicker on partial source; pulsing "Streaming" pill
- **AI-aware brand kit** — `/api/ai/generate` injects a BRAND PALETTE directive when a kit exists; AI uses those colors for echarts/mermaid theme overrides
- **Templates gallery** — `/app/templates` with 6 curated starters (onboarding funnel, OAuth, web arch, revenue chart, blog ER, roadmap gantt)

### Milestone 1.4 — Social Card Engine ✅
- **4 social card types** (timeline, versus, matrix2x2, funnel) fully wired from AI → editor → share/embed/OG/templates
- **Copy image** — Export ▾ → Copy image writes PNG to clipboard; covers all types including excalidraw and echarts dark mode
- **Social card renderer** — single dispatcher to layout sub-components (pure HTML/Tailwind, `cqw` fluid sizing)
- **Parse module** — `parseSocialCard()` in `apps/web/lib/diagrams/social-cards.ts`

### Milestone 1.5 — Social Card Suite Expansion ✅
- **8 more social card types** (Phases 14–15): venn, tierlist, iceberg, alignment, budget, habits, bingo, bracket
- All 12 social card types share the same renderer, parse module, and AI pipeline

### Milestone 1.6 — Agent Mode Polish ✅
- **Agent Mode** — alternate `/api/ai/agent/route.ts` pipeline using Vercel AI SDK tool calls; toggled in the editor UI
- **Dark mode** — Moon/Sun toggle in editor, `localStorage` + system-pref fallback, scoped via `.dark` class on editor root (app shell stays light)
- **PDF export** — client-side raster via jsPDF (PNG → single page, sized to diagram); works across all 22 types
- **`validateAndRepairOutput`** — `lib/diagrams/validate-output.ts`; shared by generate + agent routes; agent's `update_diagram` tool self-corrects within a 5-step loop
- `apply_patch` server tool rejects patches that would corrupt JSON-based diagram source

### Editor polish pass (post-1.3) ✅
- Full audit of all 7 renderers — fixed 5 real bugs (BPMN/ECharts couldn't recover from parse errors, ReactFlow crashed on AI nodes without positions, Mermaid re-init on every render, silent failure on broken hand edits)
- Added the missing **Source code editor** — right-side panel with monospaced textarea (the editor had no manual-edit surface before)
- **ReactFlow auto-layout** button (Wand2 icon)
- **Reset zoom + pan** (⌘0)
- Brand-kit colors now actually reach the Mermaid theme variables
- **Syntax highlighting** in the Source panel (zero-dep — textarea over highlighted `<pre>`)
- **Mermaid theme picker** dropdown (11 themes, all hidden previously)
- **Tab key** indents (instead of stealing focus); **line numbers** gutter; friendly **empty-state CTA**

## Key files

### Editor
- `apps/web/components/editor-client.tsx` — the main editor (~1700 lines, one big component). Holds all state: source, themeId, paletteId, customBackground/Accent, fontId, undoStack, redoStack, AI message state via `useChat`. Branches on `diagramType` in render.
- `apps/web/components/diagrams/*-renderer.tsx` — one renderer per diagram type. Common contract: `{ source: string, onChange?: (s: string) => void, readOnly?: boolean }`.
- `apps/web/lib/source-highlight.tsx` — tiny syntax highlighter used by the Source panel (Mermaid + JSON grammars).
- `apps/web/lib/template-match.ts` — scores prompt text against all templates using keyword weights; shown as suggestion card before generation.

### AI pipeline
- `apps/web/app/api/ai/generate/route.ts` — main generation route. Two-pass (intent → generation). Honors `mode` (patch / create) and injects brand-kit palette when present.
- `apps/web/app/api/ai/agent/route.ts` — Agent Mode pipeline; uses Vercel AI SDK tool calls (`update_diagram`, `apply_patch`, `update_node`). Selected in editor via `isAgentMode` state.
- `packages/core/src/diagram-types.ts` — `DIAGRAM_SYSTEM_PROMPTS` (one per type, each with type-selection rules + few-shot).
- `packages/core/src/use-cases.ts` — `USE_CASE_STYLE_INSTRUCTIONS` (presentation / social / documentation / custom).
- `apps/web/lib/diagrams/validate-output.ts` — `validateAndRepairOutput`; used by both generate and agent routes.
- `apps/web/lib/diagrams/social-cards.ts` — `parseSocialCard()` discriminated-union parser for all 12 social card types.

### Server actions
- `apps/web/app/actions/project.ts` — `createProject`, `saveProject`, `listProjects`, `getProject`, `deleteProject`, `listRevisions`, `restoreRevision`
- `apps/web/app/actions/share.ts` — `createShareLink(projectId, previewDataUrl?)`, `updateSharePreview`
- `apps/web/app/actions/brand-kit.ts` — `getBrandKit`, `saveBrandKit`
- `apps/web/app/actions/templates.ts` — `forkTemplate(id)`
- `apps/web/app/actions/profile.ts` — handle management, public diagrams list; powers `/u/[handle]` profile pages

### Public pages
- `/s/[token]` — public share viewer (HTML + branded OG)
- `/s/[token]/og` — serves real diagram PNG if captured, else branded card
- `/embed/[token]` — chromeless viewer for iframes
- `/app/templates` — gallery of starter diagrams

### Schema
- `apps/web/lib/db/schema.ts` — drizzle tables: `users`, `workspaces`, `projects`, `revisions`, `shareLinks` (with `previewDataUrl`), `brandKits`, `apiKeys`, `exportJobs`
- Migrations under `apps/web/lib/db/migrations/`. Add new ones via `pnpm --filter @flowchart/web db:generate` (or hand-write + journal entry).

## Conventions

### Product constraints
- **WYSIWYG is the core value**: the preview canvas must always show exactly what the export will look like — correct aspect ratio, correct density, no surprises.
- Changes to `DIAGRAM_SYSTEM_PROMPTS` and the intent pipeline must not break existing saved projects.
- The intent-planning LLM call must stay ≤ 2s; don't add sequential LLM calls to the generation path.

### Branching / commits
- **Work directly on `master`** — the user authorized this in the "make it legendary" session. Push after each completed phase / fix.
- Commit messages: `feat(scope): subject` / `fix(scope): subject` / `chore(scope): subject`. Body explains the *why*, not just the *what*.
- Never use `--no-verify` or `--no-gpg-sign`. Never force-push master.
- `claude/loving-brown-MphvU` is the legacy feature branch — fully merged into master, can be deleted whenever.

### Code style
- **No emojis** in code or commits unless explicitly requested.
- **No comments explaining what code does** — only WHY when non-obvious. Identifiers carry the meaning.
- **No multi-line docstrings.** One-line max.
- **No backwards-compat shims** for code that wasn't shipped publicly.
- **No new validation / error handling** for impossible cases. Trust internal callers.
- Default `text-` color is `slate-*`. Indigo for primary accents. Amber for warnings/streaming. Red for errors.

### State patterns (in editor-client.tsx)
- Undo: `recordUndo(source)` before any mutating change. 50-step capped via `UNDO_LIMIT`.
- Source vs source-with-UI: `source` is the diagram body. `sourceWithUi` (mermaid only) prepends `%% ui:{json}` for persisting palette/font/etc. Use `parseUiFromSource()` to split back.
- Streaming: `aiLoading` from `useChat`. The Mermaid render effect debounces 120 ms while loading, 0 ms otherwise, and uses `mermaid.parse()` to keep the last-good SVG visible on partial input.

### Verification
- After every fix: `pnpm --filter @flowchart/web exec tsc --noEmit` (filter `.test.ts` errors, those are pre-existing).
- After every UI change: `pnpm --filter @flowchart/web build` (catches issues tsc misses).
- `pnpm test:unit` — 13 test files (node --test, no framework). Should stay green.

### Lint warnings to ignore
There are ~41 pre-existing `@typescript-eslint/no-unused-vars` warnings in `editor-client.tsx` from old state that was never wired (e.g. `setShowTypePanel`, `setEchartsUiTheme`, `setShowStylePanel`). Don't fix unless explicitly asked — could break implicit dependencies.

## Planning docs

- `.planning/STATE.md` — current milestone / phase status
- `.planning/ROADMAP.md` — high-level roadmap with checkboxes
- `.planning/phases/MILESTONE-*.md` — milestone-level plans
- `.planning/phases/NN-name/NN-SUMMARY.md` — per-phase summary after completion

When starting a new phase, create the folder + a `NN-CONTEXT.md` if you need
planning notes; write the `NN-SUMMARY.md` at the end. Don't create planning
docs the user didn't ask for.

## Known pending items

- `apps/web/.env` Google AI key is invalid — set a valid key to run the live agent tool-card verifier (`RUN_AGENT_VERIFY=1 pnpm exec playwright test agent-mode-verify`).
- PDF export embeds a high-res PNG (pixelRatio = pngScale) — files can be large (~10 MB at scale 2). Follow-up if size matters: JPEG-encode or cap the PDF pixelRatio.
- `apply_patch` / `update_node` results are applied client-side and not server-validated (lower risk — surgical edits). Only `update_diagram` goes through `validateAndRepairOutput`.
- Excalidraw auto-layout is intentionally NOT built — it's a free-form whiteboard with no node graph to lay out.

## Supabase / database situation (as of 2026-07-10)

The original Supabase project (`flowchart`) paused on the free tier and was never replaced with a
working one — for a stretch, no database existed for this product at all. `auth()` already degrades
gracefully (returns signed-out instead of a hard 500 when Supabase is unreachable), so this didn't
show up as visible errors, just silent non-persistence.

Fix in progress: `DATABASE_URL` now points to a **Neon** project (connected via Vercel's Storage
integration — zero code change needed, `lib/db/index.ts` only reads a plain Postgres connection
string). **Auth** runs through a separate, standalone Supabase project (free-tier org was full;
this one lives under a different account) via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Not yet confirmed end-to-end (no real signup has been click-tested since the fix) — see
`docs/SAAS-AUDIT-2026-07.md` for the full writeup and remaining punch list.

Production URL: `https://drawwx.vercel.app` (`drawxyz.vercel.app` and the old `flowstudio-*.vercel.app`
aliases resolve to the same deployment).

## What's been accomplished (full milestone history)

### Milestone 1.0 — AI Diagram Quality & Precision ✅
- WYSIWYG canvas locked to export aspect ratio
- Use-case awareness (presentation / social / docs / custom)
- Smarter type selection, ambiguityScore gate, assumption banner

### Milestone 1.1 — AI Iteration & Sharing ✅
- Surgical AI edits (patch vs create mode)
- Persistent version history with restore
- Public share links + branded OG previews (`/s/[token]`)

### Milestone 1.2 — Brand & Distribution ✅
- Brand kit (palette table + Settings panel + Palette button)
- Iframe embeds (`/embed/[token]`)

### Milestone 1.3 — Legendary ✅
- Real OG previews (client PNG capture → stored on share_link)
- Streaming live Mermaid preview with last-good-SVG fallback
- AI-aware brand kit (palette injected into generation prompt)
- Templates gallery (`/app/templates`, 6 starters)

### Milestone 1.4 — Social Card Engine ✅
- 4 social card types: timeline, versus, matrix2x2, funnel
- Copy image to clipboard (all diagram types)
- Single `social-card-renderer.tsx` dispatcher
- `parseSocialCard()` parse module

### Milestone 1.5 — Social Card Suite Expansion ✅
- 8 more social card types: venn, tierlist, iceberg, alignment, budget, habits, bingo, bracket
- All 12 share the same renderer + parse module + AI pipeline

### Milestone 1.6 — Agent Mode Polish ✅
- Agent Mode (Vercel AI SDK tool calls pipeline)
- Dark mode (Moon/Sun toggle, localStorage + system pref, scoped `.dark`)
- PDF export (client-side jsPDF, works across all 22 types)
- `validateAndRepairOutput` — shared by generate + agent routes
- `apply_patch` server tool rejects corrupting patches

### Editor polish pass ✅
- Full renderer audit — fixed 5 real bugs across BPMN/ECharts/ReactFlow/Mermaid
- Source code editor panel (right-side monospaced textarea, was missing entirely)
- ReactFlow auto-layout button (Wand2)
- Reset zoom + pan (⌘0)
- Brand-kit colors reach Mermaid theme variables
- Syntax highlighting in Source panel (zero-dep)
- Mermaid theme picker (11 themes)
- Tab key indents in source; line numbers gutter; empty-state CTA

### UX / Landing polish (post-1.6) ✅
- Landing page live demo section (unauthenticated mermaid render)
- Hero CTA auth-aware (returning users go to editor, new users to sign-up)
- Responsive mobile nav + hamburger menu on pricing page
- Brand name consistency ("FlowStudio" everywhere)
- IP rate limiting + secure cookie flag on demo endpoint
- `mockDb` chain fix

If the user says "keep going" without specifying, propose new work from the roadmap.

## Things to NOT do

- **Don't merge the legacy branch back.** `claude/loving-brown-MphvU` is dead — its work is all on master.
- **Don't push to a non-master branch** without explicit ask.
- **Don't add CodeMirror / Monaco** for the source editor. The current zero-dep highlighter is intentional. Only revisit if the user asks for autocomplete or multi-cursor.
- **Don't render planning/docs files unless asked.** No `README.md` or `*.md` creation by default.
- **Don't add headless browser infra** for OG image generation. The client-capture approach in Phase 9 is the deliberate trade-off.
- **Don't try to use `gh` CLI** — this environment only has the GitHub MCP server. Repository scope is `gwaghmar/flowstudio` only.

## Quick how-tos

### Add a new diagram type (canvas renderer)
1. Add it to `DiagramType` union in `packages/core/src/diagram-types.ts`
2. Add a system prompt in `DIAGRAM_SYSTEM_PROMPTS`
3. Create `apps/web/components/diagrams/<type>-renderer.tsx` with `{ source, onChange?, readOnly? }` contract
4. Dynamic-import it in `editor-client.tsx`
5. Add a render branch in the canvas section (search "diagramType ===")
6. Add label to `TYPE_LABELS` in `/s/[token]/page.tsx` and `/og/route.tsx`
7. Add support in `share-viewer.tsx` and `embed-viewer.tsx`

### Add a new social card type (social-json)
Social card types share `social-card-renderer.tsx` and `social-cards.ts` — no new renderer file needed.
1. Add type to `DiagramType` union and `DIAGRAM_SYSTEM_PROMPTS`
2. Add a parse branch in `parseSocialCard()` in `social-cards.ts`
3. Add a layout sub-component in `social-card-renderer.tsx` and dispatch to it
4. Add label to `TYPE_LABELS`, `share-viewer.tsx`, `embed-viewer.tsx`
5. Add a template in `apps/web/lib/templates.ts` if desired

### Add a new server action
- Drop in `apps/web/app/actions/<name>.ts`
- Start with `"use server"`
- Use `auth()` + `ensureUserAndWorkspace(email)` for the auth pattern
- `revalidatePath()` what changed

### Run the app locally
```bash
pnpm install
pnpm --filter @flowchart/web dev
```
DB is mock by default. To connect Supabase, set `DATABASE_URL` and `pnpm --filter @flowchart/web db:push`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This captures the shape of the project, what's been built, and the conventions to follow. Update it as state changes.

---

## Other agents work in this repo

`AGENTS.md` is the **tool-agnostic source of truth** for this repo. This file and
`GEMINI.md` (Google Antigravity) hold tool-specific detail on top of it. If CLAUDE.md
ever contradicts AGENTS.md, AGENTS.md wins — fix this file.

**Antigravity actively works in this repo concurrently with Claude Code**, often in
the same session window. Practical consequences:

- **Uncommitted or freshly-committed changes may not be yours.** Run `git status` /
  `git log --oneline -10` before assuming a dirty or changed file is stale or wrong.
  Never `git checkout --` / `git stash` / `reset` another agent's edits without asking.
- **Re-read a file immediately before editing it** if any time has passed since you
  last read it — a concurrent commit can land mid-turn and invalidate your read state.
- **`.gemini/` and `.gemini/antigravity/` are Antigravity's** — don't edit or delete.
  Some scripts under `apps/web/scripts/` intentionally write render artifacts into
  `~/.gemini/antigravity/brain/...` paths; that's expected, not a bug.
- Commit your own work promptly so parallel edits stay small and diffable.

## Commands

```bash
# Dev
pnpm --filter @flowchart/web dev          # start Next.js on :3040

# Type-check (do after every fix)
pnpm --filter @flowchart/web exec tsc --noEmit

# Build (catches issues tsc misses)
pnpm --filter @flowchart/web build

# Unit tests (node --test, no framework)
pnpm test:unit                            # 15 files listed in root package.json → 46 suites, 193 tests

# Run a single test file
node --test --experimental-strip-types apps/web/lib/diagrams/social-cards.test.ts

# E2E (Playwright)
pnpm test                                 # full suite
pnpm exec playwright test --grep "pdf"    # filter by name

# DB
pnpm --filter @flowchart/web db:generate  # generate migration from schema changes
pnpm --filter @flowchart/web db:push      # apply to Postgres (requires DATABASE_URL)
pnpm --filter @flowchart/web db:studio    # Drizzle Studio UI
```

`test:unit` is a hand-maintained file list, not a glob — a new `*.test.ts` doesn't run
until it's added to that script in `package.json`. **Two test files on disk are currently
orphaned** (written but never run): `lib/diagrams/freeform-autolayout.test.ts` and
`lib/user-sync.test.ts`. Add them to the script when you next touch either area.

## What this is

**drawstack** — an AI-powered diagram editor. Plain-text prompt in → rendered
diagram out. Aimed at solo creators (founders, indie hackers, technical writers)
who need diagrams for decks, blog posts, docs, social posts, and embeds.

One product, three names in circulation: **drawstack** (current, repo + README),
**FlowStudio** (older docs, `.planning/`, package names `@flowchart/*`), **drawxyz**
(deploy alias). Don't "fix" the inconsistency as a drive-by.

Repo: `gwaghmar/drawstack` · Live: https://drawxyz.vercel.app

Flow: prompt → AI picks diagram type → editor renders → user iterates →
share / embed / export.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS
- **Drizzle ORM** on Postgres (Neon via `DATABASE_URL`)
- **Vercel AI SDK v6** (`ai`, `@ai-sdk/react`) — multi-provider (OpenAI / Anthropic / Google / Groq / Mistral / OpenRouter)
- **Auth.js** (Supabase) — mock-auth mode for local
- **Stripe** billing — checkout + portal routes under `app/api/billing/`, webhook at `app/api/webhooks/stripe/route.ts`, UI at `/app/billing`
- Monorepo (pnpm): `apps/web` (Next app) + `packages/core` (shared types, prompts, themes) + `packages/cli` + `packages/mcp-server` (root script `pnpm mcp:dev`)
- Mermaid + Excalidraw + ReactFlow (@xyflow) + ECharts + Nivo + bpmn-js + Konva (Freeform canvas) + D3.js + Cytoscape.js + vis-network + Fabric.js + PixiJS for diagram rendering
- Yjs + y-webrtc — P2P CRDT multiplayer on the freeform canvas (no server needed)

## Diagram types supported (27)

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
| `d3` | Data-driven SVG visualizations (force, tree, chord, sunburst, sankey) | JSON source (SVG render) |
| `cytoscape` | Graph analysis & network topologies (COSE, Dagre, Circle, Grid) | JSON source + visual graph |
| `visnetwork` | Physics-simulated network graphs with spring stabilization | JSON source + physics canvas |
| `fabric` | Layered design canvas (UI mockups, wireframes, slides, posters) | visual canvas (Fabric.js) + JSON source |
| `pixi` | High-performance WebGL canvas (animated particles, large scale nodes) | JSON source + WebGL render |
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

The 12 `social-json` types all route through `social-card-renderer.tsx` (single dispatcher). Their AI output format is JSON validated by `parseSocialCard()` in `apps/web/lib/diagrams/social-cards.ts`. D3, Cytoscape, vis-network, Fabric, and Pixi have dedicated renderers in `apps/web/components/diagrams/` validated via Zod in `validate-output.ts`.

> **⚠️ WIRING GAP (as of 2026-08-17, uncommitted):** the five newest types — `d3`,
> `cytoscape`, `visnetwork`, `fabric`, `pixi` — are fully wired in the **editor**
> (union, prompts, metadata, dynamic imports, render branches, Zod validation) and have
> `TYPE_LABELS` entries in `share-viewer.tsx` / `embed-viewer.tsx`. Still missing:
> - no renderer imports or render branches in `share-viewer.tsx` / `embed-viewer.tsx`
>   → a shared/embedded diagram of these types shows its **label but no diagram**
> - no `TYPE_LABELS` entries in `app/s/[token]/page.tsx` or `app/s/[token]/og/route.tsx`
>
> Finish steps 6–7 of the checklist before treating these five as shipped.

Renderers live in `apps/web/components/diagrams/*-renderer.tsx` and are dynamic-imported
by `editor-client.tsx` — **except `mermaid`, which has no renderer file**: it renders
inline in `editor-client.tsx` (imports `mermaid` directly, owns the streaming/debounce
gate). The cloud, erd, and orgchart renderers are the Group A xyflow family — all consume
the shared helpers in `apps/web/lib/diagrams/` (`xyflow-base.ts` = parse/serialize/
dagre-layout/change-handlers; `cloud-icons.ts`, `cloud-glyphs.tsx` = cloud-only icon
registry). erd/orgchart need no icon registry — just a `TableNode` / `PersonNode`.

**NOTE:** each Group A canvas render branch in `editor-client.tsx` MUST use `w-full` on
the wrapper — the flex parent is `items-start justify-center`, so without an explicit
width the xyflow canvas collapses to 0px and renders nothing.

`packages/core/src/diagram-types.ts` also defines `EditorMode`
(business / technology / marketing / art) and `EDITOR_MODE_CATEGORIES`, which map
`DiagramCategory` onto the editor's mode tabs — a new type needs a category, or it
won't appear in any tab.

## Shipped: agent-native freeform canvas (replaced tldraw)

`tldraw` was removed to eliminate commercial licensing restrictions. In its place:
our custom JSON-scene-graph canvas (Konva-rendered) that both humans (drag-to-edit)
and AI agents (id/name-addressed patch operations via `apply_ops`) edit as the same document —
no translation layer between what the AI writes and what the human sees.

**Full plan, history, and deferred polish: `docs/planning/freeform-canvas-engine-plan.md`
— read the "STATUS" section (line ~111) before touching this area.** As of 2026-08-17
all milestones A–K and deferred polish are complete; the canvas has since grown well
past that plan's original scope (see Engine Expansions below) — the plan doc is
history, not the current ceiling.

### ⚠️ THE most important thing to know: there are TWO render paths

The engine renders the same `CanvasDocument` through two completely separate,
hand-maintained implementations:

| Path | File | Used for | Shape coverage |
|---|---|---|---|
| **Konva** (interactive) | `freeform-renderer.tsx` (2400 lines) | the live editing canvas the user drags on | primitives + `card`, `table`, `image` only |
| **SVG** (export) | `freeform-svg.ts` (1400 lines) | `freeformToSvg` → SVG download, vector export | primitives **+ all 13 macro shapes** |

**They are out of sync today.** The Konva switch ends in `default: return null`, so these
11 macro shapes render as **literally nothing on the interactive canvas** while rendering
richly in SVG export: `dashboard`, `chart`, `mindmap`, `scurve_timeline`, `metric`,
`mockup`, `isometric_block`, `tech_hud_panel`, `layered_process_map`, `venn_timeline`,
`feed_table`.

This directly violates the project's stated #1 constraint ("WYSIWYG is the core value —
the preview canvas must always show exactly what the export will look like"). Treat it as
known technical debt, not as intended design. **Adding a macro shape means implementing it
in BOTH files**, or the canvas and the export disagree. The cheaper long-term fix is to
have Konva rasterize/embed `freeformToSvg` output for macro shapes via `Konva.Image` so
there is one source of truth — currently `freeformToSvg` is only called from
`handleExportSvg` (the download button).

**Blast radius.** The freeform system prompt in `diagram-types.ts` actively instructs the
AI to emit `dashboard` / `chart` / `scurve_timeline` / etc., so an AI-generated freeform
diagram can come back as a **blank editing canvas** that exports perfectly to SVG. And
because PNG/PDF/Copy-image/OG-capture all go through `html-to-image` over the DOM (the
Konva `<canvas>`), not `freeformToSvg`, **every raster export drops macro shapes too** —
only the explicit "Export SVG" button includes them. This drift is easy to miss because
the `apps/web/scripts/*.ts` render harnesses exercise `freeformToSvg` directly and never
open the Konva canvas — headless script output looks perfect while the app shows nothing.

### Shape vocabulary (27 types, `freeform-canvas.ts`)
- **Primitives (14):** `rectangle`, `ellipse`, `diamond`, `triangle`, `cylinder`, `cloud`,
  `hexagon`, `star`, `text`, `sticky`, `frame`, `path` (freehand), `image`, `arrow`
- **Macro shapes (13):** `card`, `table`, `chart`, `dashboard`, `metric`, `feed_table`,
  `mockup`, `mindmap`, `scurve_timeline`, `isometric_block`, `venn_timeline`,
  `tech_hud_panel`, `layered_process_map`

`BaseShape` carries: `id`, `name` (stable semantic handle for agents), `role` (domain
meaning), `x`/`y`, `rotation`, `fill`, `stroke`, `strokeWidth`, `strokeDash`, `opacity`,
`frameId`, `parentId` (grouping), `locked`, `onClickNavigateToFrameId`, and a `text` block.
`CanvasDocument` carries `version`, `renderMode: "clean" | "sketchy"` (roughjs hand-drawn
mode), `presentationMode`, `shapes` (array order = z-order).

### Ops vocabulary (`applyCanvasOps`, 7 ops)
`add` · `update` (target + set) · `delete` · `connect` (bound arrow between shapes) ·
`place` (relative positioning — "below X, gap 40") · `layout` (arrange targets as
row/column/grid) · `reorder` (front/back/forward/backward).

`place` and `layout` are the point of the whole design: the AI never does pixel math, it
expresses intent and the engine resolves geometry. Returns `{ doc, errors[] }` — ops
partially apply, errors are reported per-index rather than throwing away the batch.

### Engine API worth knowing
- `parseFreeformSource` → `{ doc, errors }` (keep-last-good), `serializeFreeformDocument`
- `computeDynamicShapeDimensions` — content-aware auto-sizing (shapes grow to fit text)
- `resolveColor` — palette shorthand (`"1"`–`"6"` → theme colors, brand-kit friendly, cheap tokens)
- `resolveArrowEndpoint` / `nearestEdgeAnchor` / `resolveArrowRenderEndpoints` — arrow binding + edge anchoring
- `getShapeBounds` — real bounds incl. arrows; drives marquee, align, export crop
- `validateFreeformRefs` — dead refs, duplicate names, bad frame links
- `autoLayoutFreeformDocument` — the "Tidy Up" button (dagre-style, LR/TB)
- `serializeForModel` / `describeCanvas` — compact model-facing view (the 70% token saving)
- `getSvgIcon` — icon registry used inside SVG macro shapes

- `apps/web/lib/diagrams/freeform-canvas.ts` — scene-graph schema (`CanvasDocument`/
  `CanvasShape`) + pure functions (parse/serialize/resolveArrowEndpoint/validateRefs).
  `parseFreeformSource` returns `{ doc, errors }` (keep-last-good — one bad AI emit must
  never wipe the canvas). Schema also carries `onClickNavigateToFrameId` (prototype
  wiring, validated against real frame ids) and `presentationMode`.
- `apps/web/lib/diagrams/freeform-ops.ts` — surgical patch ops engine (`applyCanvasOps`).
- `apps/web/lib/diagrams/freeform-model-view.ts` — compact model-facing serialization
  (the file was called `freeform-serialization.ts` in earlier planning docs — renamed).
- `apps/web/lib/diagrams/freeform-autolayout.ts` — layout passes for AI-emitted scenes.
- `apps/web/lib/diagrams/freeform-svg.ts` — `freeformToSvg`, pure vector export; also
  home to the growing library of "macro shapes" (dashboards, charts, mindmaps, S-curve
  timelines, isometric blocks, HUD panels, process maps — see diagram-types.ts for the
  full shape-type list fed to the AI).
- `apps/web/lib/diagrams/freeform-to-react.ts` — `exportFreeformToReact`, transpiles the
  scene graph to a standalone React + Tailwind component ("Copy React Prototype" in the
  Export menu).
- `apps/web/lib/diagrams/yjs-store.ts` — `YjsCanvasStore`, Yjs + `y-webrtc` P2P multiplayer.
  `FreeformRenderer` takes an optional `roomId` prop; `editor-client.tsx` passes
  `currentProjectId` so each project is automatically a shared room.
- `apps/web/components/diagrams/freeform-renderer.tsx` — Konva renderer: select, drag,
  snap, resize/rotate (`Konva.Transformer`), text editing, arrow binding, frames,
  sticky notes, freehand pen, zoom/pan, Yjs sync, and **Interactive Prototype / Present
  Mode** (▶ toggle — shapes wired via `onClickNavigateToFrameId` animate the viewport to
  the target frame on click; wired from a "Link: [Frame]" dropdown in the shape toolbar).
- `apps/web/app/api/ai/agent/route.ts` & `editor-client.tsx` — `apply_ops` tool integration.

### Hard-won canvas rules (do not relearn these)
- ALL Konva gesture bookkeeping lives in synchronously-written refs
  (`dragStateRef`/`marqueeRef`/`arrowDraftRef`/`modeRef`/`panRef`). React state read
  from a gesture handler WILL be stale mid-burst — this shipped two real bugs.
- Transformer: bake scale into width/height on `transformend`, reset scale to 1. Never store scale.
- Exactly ONE Konva node per shape carries `id={shape.id}`.
- Browser click-testing catches what tsc + tests + build cannot. Keep doing it.

## Key files

### Editor
- `apps/web/components/editor-client.tsx` — the main editor (~3200 lines, one big component). Holds all state: source, themeId, paletteId, customBackground/Accent, fontId, undoStack, redoStack, AI message state via `useChat`. Branches on `diagramType` in render.
- `apps/web/components/diagrams/*-renderer.tsx` — one renderer per diagram type (except mermaid). Common contract: `{ source: string, onChange?: (s: string) => void, readOnly?: boolean }`.
- `apps/web/lib/source-highlight.tsx` — tiny syntax highlighter used by the Source panel (Mermaid + JSON grammars).
- `apps/web/lib/template-match.ts` — scores prompt text against all templates using keyword weights; shown as suggestion card before generation.

### AI pipeline
- `apps/web/app/api/ai/generate/route.ts` — main generation route. Two-pass (intent → generation). Honors `mode` (patch / create) and injects brand-kit palette when present.
- `apps/web/app/api/ai/agent/route.ts` — Agent Mode pipeline; Vercel AI SDK tool calls (`update_diagram`, `apply_patch`, `update_node`, `apply_ops`). Selected in editor via `isAgentMode` state.
- `packages/core/src/diagram-types.ts` — `DiagramType`, `DIAGRAM_SYSTEM_PROMPTS` (one per type, each with type-selection rules + few-shot + the freeform macro-shape catalog), editor mode mapping.
- `packages/core/src/use-cases.ts` — `USE_CASE_STYLE_INSTRUCTIONS` (presentation / social / documentation / custom).
- `apps/web/lib/diagrams/validate-output.ts` — `validateAndRepairOutput`; used by both generate and agent routes. Also holds the Zod schemas for the d3/cytoscape/visnetwork/fabric/pixi JSON formats.
- `apps/web/lib/diagrams/social-cards.ts` — `parseSocialCard()` discriminated-union parser for all 12 social card types.
- `apps/web/app/api/ai/vision-to-canvas/route.ts` — **image → freeform canvas**. Takes a whiteboard photo / architecture screenshot / UI sketch and reconstructs it as a `CanvasDocument` via a vision model (`maxDuration = 60`), then runs it through `validateAndRepairOutput`.

### Full API surface
Beyond the two generation routes, `apps/web/app/api/` exposes:
- `ai/vision-to-canvas` — image → freeform canvas (above)
- `ai/list-models` — provider/model discovery for the editor's model picker
- `ai/demo` — unauthenticated landing-page demo generation (IP rate-limited, secure cookie)
- `mcp/route.ts` — **HTTP MCP endpoint** (Streamable HTTP transport) so Cursor / Claude Code can call `generate_diagram` against a running instance. Distinct from the stdio `packages/mcp-server`.
- `v1/validate` — public API: validates Mermaid source. Auth via `lib/api-auth.ts` (`getPrincipalFromRequest` — API key or session), quota via `lib/rate-limit.ts` (600/min keyed, 60/min anonymous).
- `openapi/route.ts` — OpenAPI spec for the public API
- `share/[token]` — JSON share payload; `health` — liveness; `auth/*`, `billing/*`, `webhooks/stripe`

### Other packages
- `packages/core` — shared types, `DIAGRAM_SYSTEM_PROMPTS`, use-case instructions, themes, Zod schemas (`MermaidSourceSchema`, `ApiError`). Built via `postinstall`; `apps/web` imports it as `@flowchart/core`.
- `packages/mcp-server` — standalone stdio MCP server (`pnpm mcp:dev`) for local AI IDE integration.
- `packages/cli` — command-line diagram generation.

### Supporting diagram libs (not otherwise obvious)
- `lib/diagrams/source-export.ts` — source → downloadable file conversion
- `lib/diagrams/brand-icons.ts` + `brand-icon-data.json` — brand/logo vector icon registry used by freeform macro shapes
- `lib/diagrams/provider-icons.ts` — cloud provider icon lookup
- `lib/diagrams/canvas-logger.ts` — canvas telemetry/debug logging

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

### Render scripts
`apps/web/scripts/*.ts` are one-off headless render harnesses (run with
`node --experimental-strip-types`) that exercise `freeformToSvg` against hand-authored
`CanvasDocument` fixtures and dump artifacts to disk — visual QA for new macro shapes,
not part of `test:unit`.

## Licensing note (rendering stack)

Nearly everything in the rendering stack (Konva, react-konva, Excalidraw, Mermaid,
`@xyflow/react`, ECharts, Nivo, yjs/y-webrtc, perfect-freehand, roughjs, jsPDF) is
MIT or Apache-2.0 — fine for closed-source, paid commercial use with no user-facing
attribution required. The one exception is **`bpmn-js`**, shipped under Camunda's
bpmn.io license, which has historically required either a visible "powered by
bpmn.io" link in the UI or a paid commercial embedding license to remove it — verify
current terms at bpmn.io before treating the `bpmn` diagram type as unencumbered in
a paid tier. Excalidraw-adapted code in the freeform canvas gets an attribution
header comment + a `THIRD_PARTY_LICENSES.md` entry per the canvas plan's legal section.

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
- `pnpm test:unit` should stay green.

### Lint warnings to ignore
There are ~41 pre-existing `@typescript-eslint/no-unused-vars` warnings in `editor-client.tsx` from old state that was never wired (e.g. `setShowTypePanel`, `setEchartsUiTheme`, `setShowStylePanel`). Don't fix unless explicitly asked — could break implicit dependencies.

## Planning docs

- `docs/planning/freeform-canvas-engine-plan.md` — canvas engine plan v2 + STATUS (the live one)
- `.planning/STATE.md` — milestone / phase status through v1.6
- `.planning/ROADMAP.md` — high-level roadmap with checkboxes
- `.planning/phases/MILESTONE-*.md`, `.planning/phases/NN-name/NN-SUMMARY.md`

When starting a new phase, create the folder + a `NN-CONTEXT.md` if you need
planning notes; write the `NN-SUMMARY.md` at the end. Don't create planning
docs the user didn't ask for.

## Milestone history (all shipped ✅)

- **1.0 AI Diagram Quality & Precision** — WYSIWYG canvas locked to export aspect ratio; use-case awareness (presentation / social / docs / custom); type-selection rules, ambiguityScore ≥ 90 clarify gate, assumption banner.
- **1.1 AI Iteration & Sharing** — surgical AI edits (`mode: "patch" | "create"`); persistent version history (Clock dropdown, click to restore); public share + branded 1200×630 OG (`/s/[token]`).
- **1.2 Brand & Distribution** — brand kit (`brand_kit` table + Settings panel + Palette button); iframe embeds (`/embed/[token]` + copy snippet).
- **1.3 Legendary** — real OG previews (client PNG capture → `share_link.preview_data_url`); streaming live Mermaid preview with `mermaid.parse()` gate + last-good-SVG fallback; AI-aware brand kit (BRAND PALETTE directive injected into `/api/ai/generate`); templates gallery (`/app/templates`, 6 starters).
- **1.4 Social Card Engine** — timeline / versus / matrix2x2 / funnel wired AI → editor → share/embed/OG/templates; Copy image to clipboard (all types); single `social-card-renderer.tsx` dispatcher (HTML/Tailwind, `cqw` fluid sizing); `parseSocialCard()`.
- **1.5 Social Card Suite Expansion** — venn, tierlist, iceberg, alignment, budget, habits, bingo, bracket. All 12 share renderer + parser + AI pipeline.
- **1.6 Agent Mode Polish** — Agent Mode tool-call pipeline; dark mode (Moon/Sun, `localStorage` + system pref, scoped `.dark` on editor root, app shell stays light); PDF export via jsPDF across all 22 types; `validateAndRepairOutput` shared by both AI routes (agent's `update_diagram` self-corrects within a 5-step loop); `apply_patch` rejects patches that would corrupt JSON source.
- **Editor polish pass (post-1.3)** — audit of all renderers, fixed 5 real bugs (BPMN/ECharts couldn't recover from parse errors, ReactFlow crashed on AI nodes without positions, Mermaid re-init every render, silent failure on broken hand edits); added the Source code editor panel (there was no manual-edit surface before); ReactFlow auto-layout (Wand2); reset zoom + pan (⌘0); brand-kit colors reach Mermaid theme vars; zero-dep syntax highlighting; Mermaid theme picker (11 themes); Tab indents; line-number gutter; empty-state CTA.
- **UX / Landing polish (post-1.6)** — landing live demo (unauthenticated mermaid render); auth-aware hero CTA; responsive mobile nav on pricing; IP rate limiting + secure cookie on the demo endpoint; `mockDb` chain fix.
- **Freeform canvas A–K** — see the canvas section above.
- **Engine Expansions (Figma-class, post-K, Antigravity-driven)** — Interactive Prototypes (`onClickNavigateToFrameId` + ▶ Present Mode viewport animation); React + Tailwind code export (`freeform-to-react.ts`, "Copy React Prototype"); Yjs/y-webrtc P2P multiplayer (`yjs-store.ts`, per-project room); an expanding library of macro shapes in `freeform-svg.ts` (financial dashboards, S-curve timelines, isometric blocks, Swiss mindmaps, venn timelines, tech HUD panels, layered process maps, McKinsey-standard charts).

If the user says "keep going" without specifying, propose new work from the roadmap.

## Known pending items

- **Production revenue funnel unverified** — click-test production signup → generate → Stripe checkout before public marketing launch.
- `apps/web/.env` Google AI key is invalid — set a valid key to run the live agent tool-card verifier (`RUN_AGENT_VERIFY=1 pnpm exec playwright test agent-mode-verify`).
- PDF export embeds a high-res PNG (pixelRatio = pngScale) — files can be large (~10 MB at scale 2). Follow-up if size matters: JPEG-encode or cap the PDF pixelRatio.
- `apply_patch` / `update_node` results are applied client-side and not server-validated (lower risk — surgical edits). Only `update_diagram` goes through `validateAndRepairOutput`.
- Excalidraw auto-layout is intentionally NOT built — it's a free-form whiteboard with no node graph to lay out.
- Verify bpmn.io licensing terms before selling the `bpmn` diagram type in a paid tier without attribution (see Licensing note above).
- The repo root is littered with `*.png` audit/verification screenshots from past browser click-testing sessions. Don't add more at root; write new ones to a scratch dir.

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

## Things to NOT do

- **Don't merge the legacy branch back.** `claude/loving-brown-MphvU` is dead — its work is all on master.
- **Don't push to a non-master branch** without explicit ask.
- **Don't revert or stash working-tree changes you didn't make** — Antigravity edits this repo too, often concurrently.
- **Don't add CodeMirror / Monaco** for the source editor. The current zero-dep highlighter is intentional. Only revisit if the user asks for autocomplete or multi-cursor.
- **Don't render planning/docs files unless asked.** No `README.md` or `*.md` creation by default.
- **Don't add headless browser infra** for OG image generation. The client-capture approach in Phase 9 is the deliberate trade-off.
- **Don't copy tldraw / JointJS / Penpot / D2 source** into the canvas engine — licensing. Excalidraw (MIT) may be adapted *with* an attribution header. See the "Legal foundation" section of the canvas plan.
- **Don't try to use `gh` CLI** — this environment only has the GitHub MCP server. Repository scope is `gwaghmar/drawstack`.

## Quick how-tos

### Add a new diagram type (canvas renderer)
1. Add it to `DiagramType` union in `packages/core/src/diagram-types.ts` (+ its `DiagramCategory`, so it lands in an editor mode tab)
2. Add a system prompt in `DIAGRAM_SYSTEM_PROMPTS`
3. Create `apps/web/components/diagrams/<type>-renderer.tsx` with `{ source, onChange?, readOnly? }` contract
4. Dynamic-import it in `editor-client.tsx`
5. Add a render branch in the canvas section (search "diagramType ===") — `w-full` on the wrapper
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
cp .env.example apps/web/.env.local
pnpm --filter @flowchart/web dev
```
Set `MOCK_DB=true` in `apps/web/.env.local` to run without Postgres. To use a real DB,
set `DATABASE_URL` and run `pnpm --filter @flowchart/web db:push`.

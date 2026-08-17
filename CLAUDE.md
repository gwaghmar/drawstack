# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This captures the shape of the project, what's been built, and the conventions to follow. Update it as state changes.

---

## Other agents work in this repo

`AGENTS.md` is the **tool-agnostic source of truth** for this repo. This file and
`GEMINI.md` (Google Antigravity) hold tool-specific detail on top of it. If CLAUDE.md
ever contradicts AGENTS.md, AGENTS.md wins — fix this file.

**Antigravity actively works in this repo concurrently with Claude Code**, often in
the same session window — this is not theoretical, it happens routinely (commits have
landed mid-turn, mid-poll, and mid-git-add more than once in a single session).
Practical consequences:

- **Uncommitted or freshly-committed changes may not be yours.** Run `git status` /
  `git log --oneline -10` before assuming a dirty or changed file is stale or wrong.
  Never `git checkout --` / `git stash` / `reset` another agent's edits without asking.
- **Re-check state immediately before acting on it** if any time has passed since you
  last read it — a concurrent commit or push can land mid-turn and invalidate what you
  just observed (this includes deployment/alias state, not just files — Vercel's branch
  alias can point at a different deployment than the one you just triggered).
- **`.gemini/` and `.gemini/antigravity/` are Antigravity's** — don't edit or delete.
  Some scripts under `apps/web/scripts/` intentionally write render artifacts into
  `~/.gemini/antigravity/brain/...` paths; that's expected, not a bug.
- Before committing, diff what's actually staged — a broad `git add` can sweep in a
  concurrent agent's unrelated work, or (the reverse) your own change can land inside
  *their* commit if they commit first. Verify by content, not by which commit it's in.
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
pnpm test:unit                            # hand-maintained list in package.json

# Run a single test file
node --test --experimental-strip-types apps/web/lib/diagrams/freeform-ops.test.ts

# E2E (Playwright)
pnpm test                                 # full suite
pnpm exec playwright test --grep "pdf"    # filter by name

# DB
pnpm --filter @flowchart/web db:generate  # generate migration from schema changes
pnpm --filter @flowchart/web db:push      # apply to Postgres (requires DATABASE_URL) — see caveat below
pnpm --filter @flowchart/web db:studio    # Drizzle Studio UI
```

`test:unit` is a hand-maintained file list in `package.json`, not a glob — a new
`*.test.ts` doesn't run until it's added there. Don't hardcode the file/suite/test
count anywhere (in this file, in commit messages, in code) — a stale count has already
caused real bugs twice (a test asserting an exact template count, an MCP tool reading a
field that no longer existed) once the underlying list changed and the number didn't.

**`db:push` (drizzle-kit push) is currently broken** — it crashes with a `TypeError` on
a pre-existing bug in how drizzle-kit introspects this database's RLS/CHECK constraints,
before it even reaches the actual schema diff. Generate the migration with `db:generate`,
read the resulting SQL, and if it's a small reviewable statement, apply it directly via
the `postgres` driver (see git history around commit `90fe6ae` for the exact pattern) or
via `db:studio` rather than fighting `db:push`.

## What this is

**drawstack** — an AI-powered diagram editor. One prompt in → a fully editable visual
canvas out. Aimed at solo creators (founders, indie hackers, technical writers) who need
diagrams for decks, blog posts, docs, social posts, and embeds.

One product, three names in circulation: **drawstack** (current, repo + README),
**FlowStudio** (older docs, `.planning/`, package names `@flowchart/*`), **drawxyz**
(deploy alias). Don't "fix" the inconsistency as a drive-by.

Repo: `gwaghmar/drawstack` · Live: https://drawxyz.vercel.app

Flow: prompt → AI builds it directly on the canvas → user iterates (source, drag, or
prompt again) → share / embed / export.

## The single-engine pivot (2026-08-17)

As of today, **the product is one diagram engine, not many.** Every other diagram type
— Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, BPMN, cloud/ERD/orgchart (the xyflow
family), D3, Cytoscape, vis-network, Fabric, PixiJS, and all 12 social-card types — was
deleted in full: renderer components, AI system prompts, Zod validators, share/embed
wiring, templates, everything. `DiagramType` is now a single-member union:
`export type DiagramType = "freeform";` in `packages/core/src/diagram-types.ts`.

This was a deliberate, user-directed decision, not an accident or a regression — don't
"restore" any of the deleted types without being asked. A full backup exists at git tag
`all-27-diagram-types` and branch `backup/all-27-diagram-types` if anything ever needs
to be recovered or referenced.

**One real cleanup item this left behind:** the npm dependencies for the deleted engines
(`mermaid`, `bpmn-js`, `d3`, `cytoscape`, `echarts`, `fabric`, `pixi.js`, `vis-network`)
are still listed in `apps/web/package.json` even though nothing imports them anymore —
pure bundle-size dead weight. Not yet pruned. Also, `apps/web/app/api/v1/validate` (the
public API) still validates Mermaid source specifically (`MermaidSourceSchema`) even
though the app has no Mermaid rendering left at all — a real inconsistency in the public
API surface, not yet reconciled.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS
- **Drizzle ORM** on Postgres (Neon via `DATABASE_URL`)
- **Vercel AI SDK v6** (`ai`, `@ai-sdk/react`) — multi-provider (OpenAI / Anthropic / Google / Groq / Mistral / OpenRouter)
- **Auth.js** (Supabase) — mock-auth mode for local
- **Stripe** billing — checkout + portal routes under `app/api/billing/`, webhook at `app/api/webhooks/stripe/route.ts`, UI at `/app/billing`
- Monorepo (pnpm): `apps/web` (Next app) + `packages/core` (shared types, prompts, themes) + `packages/cli` + `packages/mcp-server` (root script `pnpm mcp:dev`)
- **The freeform canvas is the entire rendering stack now**: Konva (interactive canvas) + roughjs (sketchy/hand-drawn mode) + perfect-freehand (pen tool) — all self-built scene-graph code on top, not third-party diagram libraries. See "Freeform canvas engine" below.
- **Yjs + y-webrtc** — P2P CRDT multiplayer, now with a **self-hosted WebSocket signaling
  server** (`apps/web/app/api/yjs-signaling/route.ts`, via `@vercel/functions`'
  `experimental_upgradeWebSocket` + the `ws` package) instead of depending on a public
  relay. `NEXT_PUBLIC_YJS_SIGNALING` env var overrides the signaling URL(s); unset in
  production means same-origin `wss://<host>/api/yjs-signaling`, unset locally falls back
  to `BroadcastChannel`-only sync (same-origin tabs only). Single-instance signaling —
  under Fluid Compute, peers that land on different function instances won't discover
  each other through it (documented as an accepted, revisit-if-it-matters limitation in
  the route file itself).

## Freeform canvas engine

`tldraw` was removed early on to eliminate commercial licensing restrictions. In its
place: a custom JSON-scene-graph canvas (Konva-rendered) that both humans (drag-to-edit)
and AI agents (id/name-addressed patch operations via `apply_ops`) edit as the same
document — no translation layer between what the AI writes and what the human sees.
Since the single-engine pivot, **this is the whole product**, not one editing mode among
many.

**Full history: `docs/planning/freeform-canvas-engine-plan.md`** — the plan doc predates
the single-engine pivot and today's macro-shape/validator work; treat it as history of
the original build-out (Milestones A–K, all complete), not the current ceiling.

### Render paths — now unified (was a real bug, now fixed)

The engine renders the same `CanvasDocument` two ways: the interactive Konva canvas
(`freeform-renderer.tsx`) and the SVG exporter (`freeform-svg.ts`, `freeformToSvg`).
**These used to drift** — 11 macro shapes rendered richly in SVG export but as literally
nothing (`default: return null`) on the interactive canvas, silently violating the
project's WYSIWYG constraint. Fixed: Konva now rasterizes every macro shape by calling
`freeformToSvg` on that single shape and drawing the result via `Konva.Image`
(`MacroShapeNode` in `freeform-renderer.tsx`), so there is exactly one source of truth
for how a macro shape looks. The set of shapes handled this way is
`MACRO_SHAPE_TYPES` (16 entries) in `freeform-renderer.tsx` — `card` and `table` are
older macro shapes with their own native Konva implementations, not in this set.

A related bug also fixed: the exporter used to force every `frame`/`dashboard`/`mockup`
shape to render before all non-container shapes regardless of authored array order —
meaning a plain background rectangle placed before a frame would silently paint over it,
hiding the frame entirely. Array order is the documented z-order contract; the fix now
only pulls a container ahead of its own children when those children were authored
before it in the array, leaving unrelated shapes in their authored order.

### Shape vocabulary (32 types, `freeform-canvas.ts`)
- **Primitives (14):** `rectangle`, `ellipse`, `diamond`, `triangle`, `cylinder`, `cloud`,
  `hexagon`, `star`, `text`, `sticky`, `frame`, `path` (freehand), `image`, `arrow` (also
  accepts `type: "line"`)
- **Macro shapes, native Konva (2):** `card`, `table`
- **Macro shapes, SVG-rasterized (16):** `dashboard`, `chart` (incl. `chartType: "treemap"`
  — squarified layout), `metric`, `feed_table`, `mindmap`, `scurve_timeline`,
  `step_timeline` (alternating-side timeline poster with numbered badges), `isometric_block`,
  `mockup`, `venn_timeline`, `tech_hud_panel`, `layered_process_map`, `dot_matrix`
  (halftone/dithered/dot-density art — rows of density characters, circle/square/diamond
  glyph), `pictogram` (20 hand-authored line icons — no third-party icon dependency),
  `pictogram_row` (repeated-icon "7 of 10" human-graph rows), `mesh_connector` (dense
  many-to-many crosshatch fan between two groups of points — a visual-density motif, not
  a real semantic connection)

`BaseShape` carries: `id`, `name` (stable semantic handle for agents), `role` (domain
meaning), `x`/`y`, `rotation`, `fill`, `stroke`, `strokeWidth`, `strokeDash`, `opacity`,
`frameId`, `parentId` (grouping), `locked`, `onClickNavigateToFrameId`, and a `text`
block (`content`, `fontSize`, `fontFamily`, `align`, `color`, `bold`, `wrap` — `wrap:
false` renders verbatim/monospace, for ASCII/terminal-art layouts).
`CanvasDocument` carries `version`, `renderMode: "clean" | "sketchy"` (roughjs hand-drawn
mode), `presentationMode`, `shapes` (array order = z-order).

**Arrows** (`type: "arrow" | "line"`) can carry `waypoints` (bend through N intermediate
points — all three `routing` modes generalized from 2-point to N-point: `straight` is a
real polyline, `orthogonal` bends between every consecutive pair, `curved` got its first
real implementation, a Catmull-Rom-derived smooth path) and `showJunctions` (small ring
markers at every point on the route). Note: the `connect` op in `freeform-ops.ts` does
NOT yet expose `waypoints`/`showJunctions` — only reachable via `add` + `update` ops
today; a known, deliberate gap, not an oversight. It *does* expose `arrowHeadStart` /
`arrowHeadEnd` / `labelStyle`.

**Arrowheads** are `arrowHeadStart` / `arrowHeadEnd`: `arrow` (default filled pointer),
`triangle-open` (UML inheritance), `diamond` / `diamond-open` (UML composition /
aggregation), and the five ERD crow's-foot cardinalities (`crowfoot-one`, `-many`,
`-zero-one`, `-one-many`, `-zero-many`). The legacy `arrowStart`/`arrowEnd` booleans
still apply when no style is set. Head geometry — including the trimmed line endpoint,
so a line never pokes through an open head — comes from `computeArrowHeadGeometry` in
`freeform-canvas.ts`, which returns a list of marks (polygon/polyline/ring) that BOTH
renderers draw. New notation goes there, not in either renderer.

**Text auto-fits its shape**: `fitTextFontSize` (same file) shrinks wrapped copy until
it fits the shape height, floored at 60% of the authored size, skipped for `wrap: false`
and for bare `text` shapes. Before this, copy that wrapped past the shape's height
simply spilled out of it.

### Ops vocabulary (`applyCanvasOps`, 7 ops)
`add` · `update` (target + set) · `delete` · `connect` (bound arrow between shapes) ·
`place` (relative positioning — "below X, gap 40") · `layout` (arrange targets as
row/column/grid) · `reorder` (front/back/forward/backward).

`place` and `layout` are the point of the whole design: the AI never does pixel math, it
expresses intent and the engine resolves geometry. Returns `{ doc, errors[] }` — ops
partially apply, errors are reported per-index rather than throwing away the batch.

### Engine API worth knowing
- `parseFreeformSource` → `{ doc, errors }` (keep-last-good), `serializeFreeformDocument`
- `computeDynamicShapeDimensions` — content-aware auto-sizing (shapes grow to fit text);
  `getShapeBounds` falls through to this for any shape missing width/height. This is why
  the AI-output validator (below) treats width/height as optional, not required.
- `resolveColor` — palette shorthand (`"1"`–`"6"` → theme colors, brand-kit friendly, cheap tokens)
- `resolveArrowEndpoint` / `nearestEdgeAnchor` / `resolveArrowRenderEndpoints` — arrow binding + edge anchoring
- `getShapeBounds` — real bounds incl. arrows; drives marquee, align, export crop
- `validateFreeformRefs` — dead refs, duplicate names, bad frame links (client-side; a
  server-side analog now lives in `validate-output.ts`, see below)
- `autoLayoutFreeformDocument` — the "Tidy Up" button (layered, LR/TB) AND the `layout`
  op's `arrange: "graph"` mode, which is how an AI batch can add shapes at 0,0, connect
  them, and let the engine derive all geometry. Reads `line` connections as well as
  arrows (UML/ERD edges are lines), orders each layer by neighbour barycenter to cut
  edge crossings, and centers layers against the widest one.
- `serializeForModel` / `describeCanvas` — compact model-facing view (the 70% token saving)
- `getSvgIcon` — icon registry used inside SVG macro shapes

### AI output validation — per-shape, not all-or-nothing (`validate-output.ts`)

`validateAndRepairOutput` used to validate the entire `shapes` array as one Zod union —
if even one shape was invalid, the whole document was rejected. In production this threw
away 10–20 perfectly good AI-generated shapes over one truncated straggler (hitting
`maxOutputTokens` mid-object is the single most common real failure). Shapes are now
validated **individually**; only the shape(s) that actually fail get dropped. Dropping a
shape can orphan whatever pointed at it (a child's `frameId`, an arrow's endpoint) — a
cleanup pass runs after per-shape validation: orphaned children get ungrouped (`frameId`
cleared, not deleted), arrows referencing a dropped/missing shape get dropped (can't
meaningfully render a dangling connector).

Also normalized before validation, because the model reliably emits these shapes and the
render layer already tolerates them:
- `text: "some string"` on a shape → coerced to `text: { content: "some string" }`
- `field: null` on any optional field (`fill`, `strokeDash`, etc.) → stripped; null and
  "not provided" mean the same thing here, Zod's `.optional()` doesn't accept `null`
- missing `x`/`y` → defaulted to `(0, 0)` (unlike width/height, position has no
  auto-fallback in the render layer, but a shape at the origin beats losing it)

This validator gates **every** AI generation surface — the public demo
(`/api/ai/demo`), the main generation route (`/api/ai/generate`), and Agent Mode
(`/api/ai/agent`) — so a fix here fixes reliability everywhere at once. If you find
another AI-output shape that fails validation, check whether the render layer actually
requires that field before tightening vs. loosening the schema; the pattern established
across 6 real production bugs today was consistently "the validator was stricter than
what Konva/SVG actually need," never the reverse.

### Hard-won canvas rules (do not relearn these)
- ALL Konva gesture bookkeeping lives in synchronously-written refs
  (`dragStateRef`/`marqueeRef`/`arrowDraftRef`/`modeRef`/`panRef`). React state read
  from a gesture handler WILL be stale mid-burst — this shipped two real bugs.
- Transformer: bake scale into width/height on `transformend`, reset scale to 1. Never store scale.
- Exactly ONE Konva node per shape carries `id={shape.id}`.
- Manual canvas edits must route through the same `recordUndo` path as AI edits — a past
  bug mounted the renderer with the raw `setSource` setter for hand-edits, so ⌘Z after
  editing by hand silently discarded work back to the last AI/restore snapshot. Remote
  Yjs edits from a collaborator must NOT record a local undo step (separate
  `onRemoteChange` path) — undoing your own last action shouldn't also undo theirs.
- Global ⌘Z/⌘⇧Z/⌘D/⌘V keyboard handlers need modifier + focus-target guards — past bugs
  had ⌘D (duplicate) also switching the active tool because the handler had no modifier
  guard, and global undo hijacking native undo while typing in the Source panel or title
  field.
- Browser click-testing catches what tsc + tests + build cannot. Keep doing it.

## Key files

### Editor
- `apps/web/components/editor-client.tsx` — the main editor (~3200+ lines, one big
  component). Holds all state: source, themeId, paletteId, customBackground/Accent,
  fontId, undoStack, redoStack, AI message state via `useChat`, presence identity
  (name/color) threaded into the canvas for multiplayer cursors. Freeform is now the
  only diagram type, so this no longer branches on `diagramType` across many renderers —
  it renders one canvas.
- `apps/web/components/diagrams/freeform-renderer.tsx` — the only renderer file left.
  Konva canvas: select, drag, snap, resize/rotate, text editing, arrow binding, frames,
  sticky notes, freehand pen, zoom/pan, Yjs sync + presence cursors, Interactive
  Prototype / Present Mode, and `MacroShapeNode` (SVG-rasterization for the 16 macro
  shape types — see "Render paths" above).
- `apps/web/lib/source-highlight.tsx` — zero-dep syntax highlighter for the Source panel (JSON only now — the Mermaid grammar branch was removed with Mermaid).
- `apps/web/lib/template-match.ts` — scores prompt text against the 5 surviving freeform starter templates using keyword weights.

### AI pipeline
- `apps/web/app/api/ai/generate/route.ts` — main generation route. Two-pass (intent → generation). Honors `mode` (patch / create) and injects brand-kit palette when present.
- `apps/web/app/api/ai/agent/route.ts` — Agent Mode pipeline; Vercel AI SDK tool calls (`update_diagram`, `apply_patch`, `update_node`, `apply_ops`). Selected in editor via `isAgentMode` state.
- `apps/web/app/api/ai/demo/route.ts` — unauthenticated landing-page demo. Always
  generates freeform now (used to hardcode Mermaid). `landing-demo-section.tsx` renders
  the response via the engine's own `freeformToSvg`, not a third-party library.
- `packages/core/src/diagram-types.ts` — `DiagramType` (single-member union now),
  `DIAGRAM_SYSTEM_PROMPTS.freeform` (the one remaining prompt — shape catalog,
  `ANTI_GENERIC_DIRECTIVE`, and a `DESIGN STANDARDS` block on type pairing / palette
  systems added when the macro-shape library grew).
- `apps/web/lib/diagrams/validate-output.ts` — `validateAndRepairOutput`; see "AI output validation" above.
- `apps/web/app/api/ai/vision-to-canvas/route.ts` — **image → freeform canvas**. Takes a whiteboard photo / architecture screenshot / UI sketch and reconstructs it as a `CanvasDocument` via a vision model (`maxDuration = 60`), then runs it through `validateAndRepairOutput`.

### Full API surface
- `ai/vision-to-canvas` — image → freeform canvas (above)
- `ai/list-models` — provider/model discovery for the editor's model picker
- `ai/demo` — unauthenticated landing-page demo generation (IP rate-limited, 3/day, secure cookie)
- `yjs-signaling` — self-hosted WebSocket signaling for canvas multiplayer (see Stack above)
- `mcp/route.ts` — **HTTP MCP endpoint** (Streamable HTTP transport), single
  `generate_diagram` + `list_diagram_types` tool set (simplified along with the rest of
  the app when the other 26 types were removed). Distinct from the stdio
  `packages/mcp-server`, which was separately brought in line the same day (dropped its
  Mermaid-theme-only tools, fixed `templates_list` reading a field that had gone empty).
- `v1/validate` — public API: validates Mermaid source — **stale, see "single-engine
  pivot" above**, not yet reconciled with the rest of the app.
- `openapi/route.ts` — OpenAPI spec for the public API
- `share/[token]` — JSON share payload; `health` — liveness; `auth/*`, `billing/*`, `webhooks/stripe`

### Other packages
- `packages/core` — shared types, `DIAGRAM_SYSTEM_PROMPTS`, themes, Zod schemas. Built via `postinstall`; `apps/web` imports it as `@flowchart/core`.
- `packages/mcp-server` — standalone stdio MCP server (`pnpm mcp:dev`) for local AI IDE integration.
- `packages/cli` — command-line diagram generation, freeform-only now (the `--type`/`--subtype` flags were removed along with the multi-type system).

### Supporting diagram libs (not otherwise obvious)
- `lib/diagrams/freeform-shape-catalog.ts` — shared catalog (type, label, category,
  description, icon, default size, and a `build()` returning valid starter content) for
  every placeable shape type. Not yet wired to any UI — the data layer a future toolbar
  flyout / hover-connector picker / draw.io-style sidebar can read from instead of
  re-deriving default content per surface.
- `lib/diagrams/source-export.ts` — source → downloadable file conversion (now always `.json`, the `.mmd`/`.xml` branches for Mermaid/BPMN were removed)
- `lib/diagrams/brand-icons.ts` + `brand-icon-data.json` — brand/logo vector icon registry the `card` shape's `icon` field renders through (this was briefly, mistakenly deleted as part of the diagram-type purge, then restored — it's a genuine freeform dependency, not cloud-renderer-only)
- `lib/diagrams/provider-icons.ts` — cloud provider icon lookup, used by `brand-icons.ts`'s fallback path
- `lib/diagrams/cloud-icons.ts` — currently an **orphaned file**, nothing imports it (restored alongside brand-icons.ts/provider-icons.ts in the same fix, turned out to be unused); safe to delete, just hasn't been
- `lib/diagrams/canvas-logger.ts` — canvas telemetry/debug logging
- `lib/diagrams/yjs-store.ts` — `YjsCanvasStore`; Yjs + y-webrtc P2P multiplayer, now reads `NEXT_PUBLIC_YJS_SIGNALING` for the self-hosted signaling server

### Server actions
- `apps/web/app/actions/project.ts` — `createProject`, `saveProject`, `listProjects`, `getProject`, `deleteProject`, `listRevisions`, `restoreRevision`
- `apps/web/app/actions/share.ts` — `createShareLink(projectId, previewDataUrl?)`, `updateSharePreview`
- `apps/web/app/actions/brand-kit.ts` — `getBrandKit`, `saveBrandKit`
- `apps/web/app/actions/templates.ts` — `forkTemplate(id)`
- `apps/web/app/actions/profile.ts` — handle management, public diagrams list; powers `/u/[handle]` profile pages

### Public pages
- `/` — landing page (`apps/web/app/page.tsx`). Rewritten 2026-08-17 to drop the
  pre-pivot "22 diagram types / Mermaid / Excalidraw / ReactFlow / ECharts / BPMN"
  copy — the hero, trust strip, "how it works" step, and capability chip cloud now
  describe the one freeform canvas and its real output categories, not a fictional
  library-integration list. Also fixed the site `<meta description>` (same stale claim,
  used for search/social previews). Deliberately did not hardcode a type count anywhere
  in the new copy.
- `/s/[token]` — public share viewer (HTML + branded OG)
- `/s/[token]/og` — serves real diagram PNG if captured, else branded card
- `/embed/[token]` — chromeless viewer for iframes
- `/app/templates` — gallery of starter diagrams (5 freeform starters, down from 20)

### Schema
- `apps/web/lib/db/schema.ts` — drizzle tables: `users`, `workspaces`, `projects`, `revisions`, `shareLinks` (with `previewDataUrl`), `brandKits`, `apiKeys`, `exportJobs`. `projects.diagramType` column default is `'freeform'` (was `'mermaid'`, fixed both in the Drizzle model and applied to the live database on 2026-08-17).
- Migrations under `apps/web/lib/db/migrations/`. Add new ones via `pnpm --filter @flowchart/web db:generate` (or hand-write + journal entry) — see the `db:push` caveat under Commands before trying to apply one.

### Render scripts
`apps/web/scripts/*.ts` are one-off headless render harnesses (run with
`node --experimental-strip-types`) that exercise `freeformToSvg` against hand-authored
`CanvasDocument` fixtures and dump artifacts to disk — visual QA for the canvas, not
part of `test:unit`. Historically these were the reason the Konva/SVG render-path drift
went unnoticed for so long: they exercise `freeformToSvg` directly and never open the
Konva canvas, so headless output looked perfect while the live app showed nothing. That
specific gap is closed (render paths are unified now), but the general lesson holds —
these scripts prove the exporter works, not that the interactive canvas matches it.

## Licensing note (rendering stack)

The rendering stack is now Konva, react-konva, roughjs, perfect-freehand, yjs/y-webrtc,
jsPDF — all MIT or Apache-2.0, fine for closed-source, paid commercial use with no
user-facing attribution required. The `bpmn-js` (Camunda bpmn.io license) concern from
the old multi-engine era no longer applies — BPMN was deleted along with everything
else, and the unused `bpmn-js` npm package itself was pruned 2026-08-17 (see "Known
pending items"). Excalidraw-adapted code, if any exists in the canvas
history, was meant to get an attribution header + `THIRD_PARTY_LICENSES.md` entry per
the canvas plan's legal section — not verified as part of today's work.

## Conventions

### Product constraints
- **WYSIWYG is the core value**: the preview canvas must always show exactly what the export will look like — correct aspect ratio, correct density, no surprises. (This was a real, shipped bug for the 16 macro shapes until 2026-08-17 — see "Render paths" above. Any new macro shape must render identically on both the Konva canvas and in SVG export, which the `MacroShapeNode` rasterization approach now guarantees automatically — new shapes only need a `freeformToSvg` branch, not a separate Konva implementation.)
- Changes to `DIAGRAM_SYSTEM_PROMPTS.freeform` must not break existing saved projects.
- The intent-planning LLM call must stay ≤ 2s; don't add sequential LLM calls to the generation path.

### Branching / commits
- **Work directly on `master`** — the user authorized this in the "make it legendary" session. Push after each completed phase / fix.
- Commit messages: `feat(scope): subject` / `fix(scope): subject` / `chore(scope): subject`. Body explains the *why*, not just the *what*.
- Never use `--no-verify` or `--no-gpg-sign`. Never force-push master.
- `claude/loving-brown-MphvU` is the legacy feature branch — fully merged into master, can be deleted whenever.
- `backup/all-27-diagram-types` (branch) and `all-27-diagram-types` (tag) are the
  restore point from before the single-engine pivot — don't delete these.

### Code style
- **No emojis** in code or commits unless explicitly requested.
- **No comments explaining what code does** — only WHY when non-obvious. Identifiers carry the meaning.
- **No multi-line docstrings.** One-line max.
- **No backwards-compat shims** for code that wasn't shipped publicly.
- **No new validation / error handling** for impossible cases. Trust internal callers. (The one deliberate exception: AI-output validation in `validate-output.ts`, where "impossible" cases are routine because the caller is a language model, not internal code — see "AI output validation" above for the actual design principle used there.)
- Default `text-` color is `slate-*`. Indigo for primary accents. Amber for warnings/streaming. Red for errors.

### State patterns (in editor-client.tsx)
- Undo: `recordUndo(source)` before any mutating change, including hand-edits on the
  canvas (not just AI edits — see "Hard-won canvas rules" above). 50-step capped via
  `UNDO_LIMIT`.
- Streaming: `aiLoading` from `useChat`.

### Verification
- After every fix: `pnpm --filter @flowchart/web exec tsc --noEmit` (filter `.test.ts` errors, those are pre-existing).
- After every UI change: `pnpm --filter @flowchart/web build` (catches issues tsc misses).
- `pnpm test:unit` should stay green.
- **For anything AI-generation-related, verify against the real model, not just unit tests.** Every real bug found in the validator today (6 of them) was found by generating actual output against the real provider and watching it fail — none were caught by tsc, the build, or the existing unit test suite alone. A local script that imports `validateAndRepairOutput` and `generateText` directly (bypassing any rate limiter) is the fastest way to stress-test this; see git history around commits `bfb7336`..`1c02b89` for the pattern.
- **After deploying, verify the live site directly** — don't trust a green build alone. The Vercel branch alias (`drawxyz-git-master-govw.vercel.app`) has raced its own deployment target more than once this session (a poll can catch an older "Ready" deployment before the new one even starts building). Cross-check against the deployment's own unique URL or `vercel inspect <alias> | grep commit` before declaring a fix live.

### Lint warnings to ignore
There are pre-existing `@typescript-eslint/no-unused-vars` warnings in `editor-client.tsx` from old state that was never wired. Don't fix unless explicitly asked — could break implicit dependencies.

## Planning docs

- `docs/planning/freeform-canvas-engine-plan.md` — canvas engine plan v2 + STATUS — predates the single-engine pivot, history not current ceiling (see "Freeform canvas engine" above)
- `.planning/STATE.md` — milestone / phase status through v1.6 (predates the pivot too)
- `.planning/ROADMAP.md` — high-level roadmap with checkboxes
- `.planning/phases/MILESTONE-*.md`, `.planning/phases/NN-name/NN-SUMMARY.md`

When starting a new phase, create the folder + a `NN-CONTEXT.md` if you need
planning notes; write the `NN-SUMMARY.md` at the end. Don't create planning
docs the user didn't ask for.

## Milestone history

- **1.0–1.6** — AI diagram quality, iteration/sharing, brand kit, "Legendary" (real OG
  previews, streaming preview, templates gallery), the 12-type social card engine, Agent
  Mode + dark mode + PDF export. All shipped against the old multi-engine architecture;
  most of the type-specific work in these milestones (social cards, xyflow family, D3/
  Cytoscape/vis-network/Fabric/PixiJS) no longer exists in the codebase — kept here as
  historical record of what was built and learned, not as current architecture.
- **Freeform canvas A–K** — the canvas engine build-out (schema, ops, Konva renderer,
  AI wiring) — see `docs/planning/freeform-canvas-engine-plan.md`.
- **Engine Expansions (post-K)** — Interactive Prototypes, React/Tailwind code export,
  first Yjs/y-webrtc multiplayer pass, the growing macro-shape library.
- **The single-engine pivot (2026-08-17)** — user-directed removal of all 26 other
  diagram types down to freeform-only. Same day: a 6-level reference-image ladder added
  real capability to the engine (dot-matrix/halftone art, alternating-step timelines,
  treemap charts, a 20-icon pictogram library, human-graph rows, arrow waypoints +
  junction markers, a many-to-many mesh connector); the Konva/SVG render-path drift and
  a frame z-order bug were found and fixed; the AI-output validator was hardened through
  6 real production bugs (per-shape validation + reference cleanup, null-field handling,
  bare-string text coercion, missing x/y defaulting) found by testing against the real
  model, not just unit tests; the landing page's pre-pivot marketing copy was rewritten;
  and (concurrently, by Antigravity) self-hosted Yjs signaling + presence cursors shipped
  alongside fixes for undo/duplicate/paste/frame-rename bugs on the canvas.

If the user says "keep going" without specifying, propose new work from the roadmap.

## Known pending items

- **Unused npm dependencies — removed (2026-08-17).** `mermaid`, `bpmn-js` +
  `bpmn-auto-layout` + `bpmn-moddle`, `d3`, `cytoscape`, `echarts` +
  `echarts-for-react`, `fabric`, `pixi.js`, `vis-network`, plus
  `@excalidraw/excalidraw`, `@mermaid-js/mermaid-cli`, `@xyflow/react`, the
  `@nivo/*` chart family, and `@dagrejs/dagre` (the "Tidy Up" auto-layout is a
  hand-rolled dagre-style algorithm, not the package) were pruned from
  `apps/web/package.json` — 526 packages removed, `pnpm audit` dropped from
  122 to 87 vulnerabilities. `next-auth`/`@auth/core`/`next`/`hono` (the last
  via `@modelcontextprotocol/sdk`) still carry real vulnerabilities and need
  version bumps with real testing — not done here, since those are actively
  used.
- **`apps/web/app/api/v1/validate` still validates Mermaid source** — the one place in
  the public API surface that wasn't reconciled with the single-engine pivot.
- **`lib/diagrams/cloud-icons.ts` is an orphaned file** — nothing imports it, safe to delete.
- **Production revenue funnel unverified** — click-test production signup → generate → Stripe checkout before public marketing launch.
- **`db:push` is broken** — see the Commands section caveat.
- `apps/web/.env` Google AI key is invalid — set a valid key to run the live agent tool-card verifier (`RUN_AGENT_VERIFY=1 pnpm exec playwright test agent-mode-verify`).
- PDF export embeds a high-res PNG (pixelRatio = pngScale) — files can be large (~10 MB at scale 2). Follow-up if size matters: JPEG-encode or cap the PDF pixelRatio.
- `apply_patch` / `update_node` results are applied client-side and not server-validated (lower risk — surgical edits). Only `update_diagram` goes through `validateAndRepairOutput`.
- The `connect` op in `freeform-ops.ts` doesn't expose `waypoints`/`showJunctions` (see "Shape vocabulary" above) — reachable via `add`/`update` only.
- **Two long-standing Konva/SVG default mismatches were fixed on 2026-08-17** — the exporter drew a drop shadow on every non-frame shape (Konva only ever drew one for sticky/card/table) and fell back to a pale border for a stroke-less shape (Konva uses `#1e293b`). Both now follow Konva. This *does* change how pre-existing projects export: primitives lose a shadow the canvas never showed, and unstroked shapes/connectors gain the outline the canvas always had. `shadow: true` restores a shadow per shape.
- The repo root is littered with `*.png` audit/verification screenshots from past browser click-testing sessions. Don't add more at root; write new ones to a scratch dir.

## Supabase / database situation (as of 2026-08-17)

`DATABASE_URL` points to a **Neon** project (connected via Vercel's Storage integration
— zero code change needed, `lib/db/index.ts` only reads a plain Postgres connection
string). **Auth** runs through a separate, standalone Supabase project via
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The database itself is
confirmed working — a real migration (the `diagramType` column default) was generated,
reviewed, and applied directly to it today, and verified against `information_schema`
before/after. **Still not confirmed:** a real end-to-end signup → generate → checkout
flow hasn't been click-tested since the DB was reconnected. See
`docs/SAAS-AUDIT-2026-07.md` for the original writeup and punch list (dated, but the
remaining open items are still open).

Production URL: `https://drawxyz.vercel.app` (`drawwx.vercel.app` and other Vercel
project aliases resolve to the same deployment).

## Things to NOT do

- **Don't merge the legacy branch back.** `claude/loving-brown-MphvU` is dead — its work is all on master.
- **Don't push to a non-master branch** without explicit ask.
- **Don't revert or stash working-tree changes you didn't make** — Antigravity edits this repo too, often concurrently, and has landed real, verified, working commits (self-hosted multiplayer signaling, several canvas bug fixes) mid-session more than once.
- **Don't restore any of the deleted diagram types** without being explicitly asked — the deletion was deliberate and user-directed. Use the `all-27-diagram-types` tag/branch if something needs to be recovered or referenced.
- **Don't add CodeMirror / Monaco** for the source editor. The current zero-dep highlighter is intentional. Only revisit if the user asks for autocomplete or multi-cursor.
- **Don't render planning/docs files unless asked.** No `README.md` or `*.md` creation by default — but DO keep existing docs (this file, `AGENTS.md`, `README.md`) accurate when they actively contradict the current codebase; a stale doc that confidently states something false is worse than no doc.
- **Don't add headless browser infra** for OG image generation. The client-capture approach in Phase 9 is the deliberate trade-off.
- **Don't copy tldraw / JointJS / Penpot / D2 source** into the canvas engine — licensing. Excalidraw (MIT) may be adapted *with* an attribution header. See the "Legal foundation" section of the canvas plan.
- **Don't try to use `gh` CLI** — this environment only has the GitHub MCP server. Repository scope is `gwaghmar/drawstack`.
- **Don't hardcode a diagram-type count, template count, or test count anywhere.** Twice today a hardcoded number silently went stale and caused a real bug (a test asserting an exact template count after templates were deleted; an MCP tool reading `t.mermaid`, always `""`, instead of `t.source`). Describe things structurally ("the hand-maintained list in package.json," "however many templates currently exist") instead.
- **Don't trust a single "Ready" status from the Vercel branch alias as proof a specific commit is live.** Verify the commit SHA on the deployment, or check the deployment's own unique URL directly — the alias has raced its target more than once in a single session.

## Quick how-tos

### Add a new macro shape to the freeform canvas
1. Add the shape's TS type in `apps/web/lib/diagrams/freeform-canvas.ts` and add it to the `CanvasShape` union
2. Add a render branch in `apps/web/lib/diagrams/freeform-svg.ts` (`freeformToSvg`) — this is the ONLY renderer you need to write; Konva picks it up automatically via rasterization once you do step 3
3. Add the shape's type name to `MACRO_SHAPE_TYPES` in `apps/web/components/diagrams/freeform-renderer.tsx`
4. Add the type to `FreeformSizedShapeSchema`'s enum in `apps/web/lib/diagrams/validate-output.ts` (and to the agent route's add-op enum in `apps/web/app/api/ai/agent/route.ts`) so AI-generated instances of it pass validation
5. Document it in the freeform prompt catalog (`packages/core/src/diagram-types.ts`, `DIAGRAM_SYSTEM_PROMPTS.freeform`) with a worked JSON example, so the AI actually knows to emit it
6. Verify: render a real document containing the new shape through `freeformToSvg` directly (see `apps/web/scripts/*.ts` for the pattern) AND open it in the live Konva canvas — these can still diverge if you get a field name wrong between the two, even with rasterization unifying the *rendering*, if the schema/validator disagree on what fields exist

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
set `DATABASE_URL` and run `pnpm --filter @flowchart/web db:push` (see the `db:push`
caveat under Commands — it may be broken; use `db:generate` + manual apply instead).

# FlowStudio Agent-Native Canvas — Plan v2 (supersedes the v1 12-milestone plan)

> v2 (2026-08-16) replaces the original "rebuild tldraw from scratch" scope after a
> three-lane research pass (licenses/code, market gaps, agent-native formats).
> Milestones 1–2 of the v1 plan shipped (`freeform-canvas.ts`, `freeform-canvas.test.ts`,
> `freeform-renderer.tsx` with select/move/delete) and carry forward unchanged.

## Product thesis (from market research)

The #1 unfilled gap across the diagram market: **no tool lets AI and humans co-edit
the same diagram without destroying each other's work.** Auto-layout tools (Mermaid,
every AI generator) give no layout control; manual tools (draw.io, Miro, Lucid) give
no AI structure; every AI regeneration nukes hand-placed positions. The composite
user story nobody serves: *"AI drafts it, I fix it by hand, AI makes a targeted
change without wrecking my fixes."*

That is exactly what an id-addressed JSON scene graph with surgical patch ops does.
Secondary gaps we also hit: diagrams that version-control (text-serializable scene
graph diffs in git; Mermaid diffs but loses layout, draw.io keeps layout but can't
diff), performance (Miro dies at ~1k objects), and Excalidraw-grade interaction
fundamentals (instant start, rock-solid select/drag — the boring basics are the moat).

Honest scope limits: sell the whiteboard/proposal/social use case. Don't promise
as-built codebase archaeology (LLMs hallucinate real-system structure — Ilograph).

## Legal foundation (verified from LICENSE files, 2026-08-16)

- **Depend on (MIT, safe):** `konva`, `react-konva`, `perfect-freehand` (freehand pen,
  take as-is), `roughjs` (sketchy style), later `yjs` (collab). Already in-app: `@xyflow/react`, `mermaid`.
- **Copy-with-attribution (MIT):** **Excalidraw** is the one codebase to actively mine —
  element schema patterns (`packages/element/src/types.ts`), arrow-binding logic
  (`binding.ts`), fractional z-index, bound-text mechanics. Any copied/adapted module
  gets a header comment (`Portions adapted from Excalidraw (MIT, (c) 2020 Excalidraw)`)
  and an entry in a new `THIRD_PARTY_LICENSES.md` (also list perfect-freehand, roughjs, Konva).
- **Ideas only, strictly no code:** tldraw (custom commercial license covers the source —
  no reading-then-transcribing; concepts from public docs only: record store, bindings-as-
  records, history marks). JointJS / Penpot / D2 (MPL-2.0 — copying a file open-sources it).
  mxGraph (modified Apache with field-of-use clause, archived — use drawio, plain
  Apache-2.0, as routing-algorithm reference instead).

## Architecture — four layers

**One canonical JSON document** (unchanged principle from v1): same format for AI
generation, internal state, and the saved `source` string. React state is the source
of truth; Konva only renders it. Z-order = array order.

### L1 — Document schema (`freeform-canvas.ts`, additive changes to milestone-1)
- Add `name?: string` to `BaseShape` — stable semantic handle ("api-server",
  "step-3") so agents and humans target "the database box" without ids leaking into
  conversation. Enforce name uniqueness in `validateFreeformRefs`. Optional
  `role?: string` for domain meaning ("database", "decision").
- Harden `parseFreeformSource`: return `{ doc, errors }` and keep-last-good instead of
  silently returning an empty document on malformed JSON (one bad AI emit must never
  wipe the canvas — same principle as the streaming `mermaid.parse()` gate).
- `resolveArrowEndpoint` on a dead ref: surface a validation error, never guess `(0,0)`.
- `getShapeBounds` for arrows: compute real bounds from resolved endpoints (spatial
  queries, marquee, export crop all depend on it).
- Arrow `label?: string`; palette shorthand colors (named/numbered theme colors,
  JSON-Canvas-style `"1"–"6"`, resolved at render time — cheaper tokens, brand-kit friendly).

### L2 — Ops engine (`freeform-ops.ts`, new; the heart of agent-native)
Id/name-addressed typed operation list — NOT RFC-6902 JSON Patch (index-addressed,
goes stale) and NOT search-replace (anchor ambiguity, aider's documented top failure):
```json
{ "ops": [
  { "op": "add", "shape": { "id": "db1", "type": "rectangle", "name": "database" } },
  { "op": "update", "target": "api", "set": { "fill": "2", "text.content": "API v2" } },
  { "op": "delete", "target": "old-note" },
  { "op": "connect", "from": "api", "to": "db1", "label": "reads" },
  { "op": "place", "target": "db1", "below": "api", "gap": 80, "align": "center" },
  { "op": "layout", "targets": ["a","b","c"], "arrange": "row", "gap": 40 },
  { "op": "reorder", "target": "db1", "to": "front" }
] }
```
- `target` accepts id or unique name; ambiguous name → structured error listing all
  candidates, never a silent pick (dtour/excalidraw-mcp pattern).
- **Relative placement** (`place`, `layout`, `inside: <frameName>`) so the agent
  rarely writes a coordinate — the engine owns geometry (D2/TALA lesson). Absolute
  x/y stays legal for humans and precise asks.
- Auto-size boxes from text with ~15% over-estimation (models can't measure text).
- **Validate–repair–report:** apply good ops, return per-op errors for bad ones;
  dedupe ids, round coordinates, cascade/re-anchor on delete (no dangling refs).
  Never silently guess.
- Full-document `replace` stays as the escape hatch for big restructures.

### L3 — Model-facing serialization (read view ≠ storage format)
- Integer-rounded coordinates, stable key order, one-line-per-shape JSON (captures
  most of TOON's 30–60% token saving while staying `JSON.parse`-able).
- Canvas-absolute coordinates only, stated in the prompt (tldraw built dedicated
  sanitization for viewport-relative confusion — avoid the class entirely).
- Later, at scale: tiered fidelity (full props for targeted shapes, `{id, name,
  type, bounds, text}` for the rest, cluster summaries beyond — tldraw agent kit).

### L4 — Konva renderer (human editing; keep Excalidraw's virtues sacred)
Existing `freeform-renderer.tsx` (select/move/delete/nudge, ref-guard onChange) plus:
resize/rotate via `Konva.Transformer`, contentEditable text overlay, bounds+handle
snapping, arrow-binding UX, frames, sticky notes, zoom/pan. Undo/redo: zero new code —
the editor's generic `undoStack` works because the renderer serializes the whole doc
per committed change. Export: falls into the existing `html-to-image` fallback first.

## AI wiring

- Generation: `DIAGRAM_SYSTEM_PROMPTS.freeform` emits the L1 document; Zod
  `FreeformCanvasSchema` in `validate-output.ts` + `validateFreeformRefs` (mirrors the
  reactflow pattern).
- Agent mode: new `apply_ops` tool (server: `agent/route.ts` next to `update_node`;
  client: the tool-effect `useEffect` in `editor-client.tsx`). Supersedes the v1 plan's
  narrower `update_shape`. String-based `apply_patch` is explicitly the wrong tool here.
- Both routes reuse `validateAndRepairOutput`.

## Build order (each step = one bounded Sonnet coding task; tsc + unit tests green after each)

- **A. Schema upgrade + parse hardening** (L1 above) — pure lib + tests. ✅ safe on
  master (freeform unreachable in app). NOTE: `parseFreeformSource` → `{ doc, errors }`
  and doc-aware arrow `getShapeBounds` are signature breaks — the same task must
  migrate `freeform-renderer.tsx` (keep-last-good lives there) and
  `freeform-canvas.test.ts`, or tsc/tests can't go green.
- **B. Ops engine** (`freeform-ops.ts` + tests): apply/validate/repair, relative placement, auto-size, cascade delete.
- **C. Model-facing serialization** (compact read view, palette resolution) + tests.
- **D. Renderer: resize + rotate** (`Konva.Transformer`).
- **E. Text editing** (contentEditable overlay, commit on blur/Escape).
- **F. Snapping + arrow tool + binding UX** (bound arrow follows its shape).
- **G. Frames + sticky + insertion toolbar + zoom/pan.**
- **H. AI generation wiring** (system prompt + Zod + `update_diagram` path).
- **I. `apply_ops` agent tool** (server + client).
- **J. App wiring checklist** (`DiagramType`, `VALID_TYPES`, `TYPE_LABELS` ×2,
  share/embed viewers, suggestion chips, Source panel, **`w-full` wrapper gotcha**).
  (`THIRD_PARTY_LICENSES.md` is created the moment the first Excalidraw-adapted
  module lands — likely milestone F — not deferred to J.)
- **K. tldraw removal** (own revertible commit): repoint Art Board at freeform (+
  Excalidraw), handle existing `diagramType: "tldraw"` saves (read-only or convert),
  drop the dependency. This resolves the commercial-license risk — mandatory before
  charging subscribers.

Interactive milestones (D–G) can be click-tested via the `/freeform-lab` harness in
`~/FLOWSTUDIO-canvas-lab`; pure-lib milestones (A–C) run entirely on unit tests here.

## Deferred (explicit, not silently dropped)
Freehand pen (perfect-freehand — dep is ready), sketchy render mode (roughjs),
tiered-fidelity reads, multiplayer (yjs; schema stays flat-record/id-ref so the door
stays open), image shapes, nested frames, pixel-perfect export.

## Launch risks (tracked, not part of this build)
- **Unverified revenue funnel**: signup → generate → checkout → plan flip has not been
  click-tested on production since the Neon/Supabase move. Do before launch.
- Billing UX: market churn evidence says billing betrayal (seat traps, surprise
  renewals) drives churn more than price — keep ours boring and honest.

## Verification per milestone
`pnpm --filter @flowchart/web exec tsc --noEmit` · `pnpm test:unit` · UI milestones
additionally `pnpm --filter @flowchart/web build` + manual click-through.

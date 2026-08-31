# Engine v2 Paper-class architecture contract

Status: proposed implementation contract
Date: 2026-08-30

This document defines the next architecture for Engine v2. “Paper-class” means a
fast, composable visual document editor with reliable direct manipulation, reusable
components and styles, multiple pages, deterministic export, and safe human/agent
co-editing. It does not mean cloning Paper’s product or importing its proprietary
implementation.

## Current baseline and design rules

The shipped baseline is `EngineDocument` version 2, `engine: "dom-css"`, with an
artboard, tokens, and recursive `EngineNode` children. Nodes currently include text,
metric, chart, graph, and frame. `compiler.ts` validates the document, `transactions.ts`
normalizes nested nodes into records plus child orders, collaboration persists revisions,
and `export.ts` emits JSON, SVG, print HTML, and React TSX.

The following remain invariant:

- One canonical document model feeds editor, agent, collaboration, and exports.
- Rendering is deterministic and exportable. DOM/CSS preview and export must share
  computed layout and token resolution, with no silent fallback that changes meaning.
- IDs are stable and names are human-facing handles. Names may be ambiguous only when
  an API explicitly returns candidates; an agent operation must never guess.
- Every committed edit is a transaction with origin, actor, revision, and undo meaning.
- Invalid imported or model-produced data is rejected or repaired with structured issues;
  it must not replace the last valid document.
- Responsive flow is the default. Absolute positioning is opt-in per page/frame.

## Target component boundaries

```text
Document kernel
  schema/versioning, IDs, pages, nodes, components, tokens, assets, invariants
Transaction kernel
  typed commands, preconditions, inverse, batching, history, conflict metadata
Views
  DOM editor, selection/transform/inspector, page navigator, comments/presence
Compilers
  layout + resolved style snapshot, DOM preview, SVG/PDF/HTML/React exporters
Agent gateway
  inspect/read views, intent -> plan, validate -> preview -> commit, explain errors
Persistence/collaboration
  snapshots, append-only revisions, Yjs synchronization, compaction and recovery
Integration adapters
  legacy freeform reader, JSON import/export, image/SVG asset ingestion
```

The kernel must be framework-independent TypeScript. React components may consume
kernel selectors but may not mutate document objects directly. The compiler accepts a
document plus viewport/export target and returns a resolved render plan. Both the DOM
renderer and exporters consume that plan, so layout calculations are not duplicated.

## Canonical document model evolution

Version 3 should preserve the current node vocabulary while changing the root from one
artboard to a document with ordered pages:

```ts
type EngineDocumentV3 = {
  version: 3; engine: "dom-css";
  metadata: { id: string; name: string; createdAt: string; updatedAt: string };
  tokens: TokenSet;
  assets: Record<string, AssetRef>;
  components: Record<string, ComponentDefinition>;
  pages: Page[];
};
type Page = { id: string; name: string; width: number; height: number | "auto";
  background: Paint; root: FrameNode; viewport?: ViewportState };
```

Nodes gain additive, optional fields: `parentId` is derived rather than stored,
`transform` (`x`, `y`, `rotation`, scale), `opacity`, `blendMode`, `visible`, `locked`,
`styleRef`, `componentRef`, `instanceOverrides`, and `assetRef`. Frames declare
`layout: flow | absolute | grid`; absolute geometry is expressed in page coordinates.
Connectors, comments, guides, and selections are separate records, not fake visual
children. This keeps z-order and bindings inspectable and makes non-rendering metadata
safe to omit from exports.

Tokens become typed, named variables with aliases and fallback values: colors, spacing,
radii, typography, shadows, and motion. A resolved token snapshot is stored in a
transaction for deterministic replay, but the source document stores references.
Assets are content-addressed (`sha256`, mime, dimensions, source, license) and never
inline unbounded binary data in the document.

Components are immutable definitions with named slots and variant properties. An
instance references a definition and stores only overrides. Detaching is an explicit
transaction. Recursive components, arbitrary code execution, and hidden style mutation
are disallowed.

## Transactions, agents, and collaboration

All edits enter through `DocumentCommand` and produce a transaction envelope:

```ts
{ id, baseRevision, actorId, origin, timestamp, commands, preconditions,
  inverse, affectedIds, warnings }
```

Commands address IDs or unique names, support relative placement, and include explicit
preconditions (`exists`, `typeIs`, `revisionIs`). The kernel applies commands atomically
for a user gesture or agent proposal. A batch is one undo step. Text input uses a short
debounce/commit boundary so each keystroke is not a collaboration revision. Remote edits
never enter local undo history.

The agent flow is inspect -> propose transaction -> validate/repair -> render a diff
preview -> user approval (unless an explicitly enabled safe mode) -> commit. Agent safe
mode permits only bounded edits to existing IDs and cannot change permissions, assets,
billing, or sharing. Every rejected command returns path, reason, candidates, and a
repair suggestion. The model-facing read view is compact and tiered: page summary,
subtree detail, then full records only when requested.

Collaboration uses the transaction envelope over the existing Yjs/shared-document
transport. Server persistence records revision plus snapshot checkpoints; clients may
rebase commutative property patches, but geometry/order conflicts require a visible
conflict result. Presence, cursors, comments, and transient selection are ephemeral and
must not dirty the saved document.

## Import, render, and export pipeline

All inputs follow: detect -> parse -> migrate -> validate -> normalize -> preview ->
commit. Migration is pure and produces an audit trail. JSON is the lossless interchange
format. SVG is vector-first and embeds resolved fonts only when licensed. HTML/React
exports use the same resolved render plan. PDF/raster export is a later adapter and must
declare page size, font availability, and any lossy features.

Legacy `EngineDocument` v2 remains readable indefinitely through a v2-to-v3 migration:
the root artboard becomes one page, root frame remains the page root, and existing token
names and node IDs are preserved. Legacy freeform documents continue through their
existing reader/editor; no heuristic conversion occurs. A user-requested “Convert” flow
creates a new v3 revision with a reversible backup and a conversion report.

## Phased milestones and verification gates

### Phase 0: kernel contract

Define v3 schema, discriminated unions, migration fixtures, stable serialization, and
invariant/error codes. Gate: v2 fixtures round-trip, malformed nested records fail
closed, IDs/order survive repeated normalize/serialize cycles.

### Phase 1: transaction kernel

Replace UI-specific diffs with commands, preconditions, inverse operations, grouped text
commits, and revision metadata. Gate: undo/redo, remote edits, concurrent stale bases,
and agent partial failure have deterministic tests.

### Phase 2: Paper authoring primitives

Add pages, zoom/pan, absolute frame mode, x/y/rotation, opacity/blend, shadows, lock/
visibility, typography controls, guides, and keyboard-complete selection. Gate: desktop,
tablet, phone, keyboard-only, 200% zoom, forced colors, and reduced motion checks; no
document-level horizontal overflow.

### Phase 3: tokens, assets, components

Add token inspector and validation, asset library/import, component definitions,
instances, slots, variants, and detach. Gate: no dangling refs, deterministic fallback
tokens, licensed asset metadata, and export parity for instance overrides.

### Phase 4: agent-native workflow

Add compact tiered read views, transaction proposal previews, approval/safe modes,
structured diagnostics, and check-layout feedback. Gate: an agent can make a targeted
change without moving untouched nodes; every mutation is attributable and undoable.

### Phase 5: collaboration and scale

Add server checkpoints, rebase/conflict UI, comment anchors, asset synchronization,
virtualized page/layer views, and bounded document limits. Gate: reconnect/offline merge,
revision recovery, 500+ nodes, and no measurable preview/export divergence.

### Phase 6: export and release hardening

Unify SVG/HTML/React output on the render plan, add PDF/raster adapters, accessibility
metadata, and migration telemetry. Gate: golden render snapshots, text/font disclosure,
security review of imports/assets, production funnel test, and live verification by commit
SHA.

## Explicit non-goals

- Reintroducing deleted diagram engines or maintaining separate renderer-specific models.
- Pixel-perfect cloning of Paper or importing its code, protocol, or proprietary assets.
- Real-time multiplayer cursors as a substitute for conflict-safe persistence.
- Automatic archaeology of a real codebase or claims that generated diagrams are factual.
- Unbounded plugin code execution inside imported documents.
- Silent lossy conversion, silent conflict resolution, or publishing to production as a
  side effect of local preview work.

## Evidence and open verification

The 2026-08-30 minute audit confirms current validation/save/export foundations and
identifies missing controls, per-keystroke transactions, weak inner graph validation,
and hidden invalid-state feedback. The 2026-08-28 production audit confirms v2 sharing,
collaboration, responsive drawers, exports, and legacy freeform routing, while noting
that real-model generation was credit-gated. Those facts are the baseline for the gates
above, not a claim that the proposed phases are implemented.

# FLOWSTUDIO handoff

## Current state

- The working product is the single freeform canvas editor.
- Local preview: `http://localhost:3040`.
- The editor uses the Engine V2/V3 scene graph with Konva rendering and SVG export.
- Stripe remains disabled for local testing.
- No deployment was performed as part of this handoff.

## Verified locally

- Health endpoint reports web, database, and auth healthy.
- Unit suite passes.
- The Engine V2 Playwright suite passes, including drag and resize coverage.
- Typecheck and production build were previously verified after the latest editor changes.

## Recent editor work

- Canvas nodes expose selection state and draggable cursor affordances.
- Browser text selection is suppressed during canvas gestures.
- The left tool rail has room for its labels on desktop and mobile.
- Empty inspector guidance is present when nothing is selected.

## Git and handoff

- The source branch is `master`; GitHub currently has `origin/master`.
- Local `master` contains the current committed work and is ahead of `origin/master`.
- This document is the handoff point for the branch consolidation.
- Untracked scratch scripts and local audit artifacts were intentionally not included.

## Next product work

1. Exercise the editor manually at desktop and mobile sizes and record any concrete interaction failures.
2. Prioritize any remaining freeform editing gaps: direct text editing, color controls, multi-selection, and unconstrained resizing.
3. Keep Konva editing and SVG export visually identical when adding shapes or behavior.
4. Run unit tests, typecheck, build, and the relevant Playwright tests before each commit.

## Useful commands

```bash
pnpm --filter @flowchart/web dev
pnpm test:unit
pnpm --filter @flowchart/web exec tsc --noEmit
pnpm --filter @flowchart/web build
pnpm exec playwright test e2e/engine-v2.spec.ts
```

# Roadmap: Flowchart AI — Diagram Platform

> **⚠️ SUPERSEDED (2026-08-17).** Historical record of the pre-single-engine roadmap
> (multi-renderer product: Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, BPMN, etc.).
> Current source of truth: `CLAUDE.md` and `docs/planning/freeform-canvas-engine-plan.md`.
> Don't add new phases here — this file is closed.

## Overview

Three focused improvement phases to make the diagram platform significantly smarter and more precise. Phase 1 delivers the most critical feature: WYSIWYG preview where the canvas always matches the export size. Phase 2 makes the AI understand context â€” inferring platform from user prompts and applying the right export preset and style conventions automatically. Phase 3 upgrades the AI's generation quality across the board â€” better type selection, deeper content extraction, style cue interpretation, and a fixed clarification threshold.

## Phases

- [x] **Phase 1: WYSIWYG Canvas** â€” Preview renders at exact export aspect ratio â€” what you see is what you export
- [x] **Phase 2: Use-Case Awareness** â€” AI infers target platform from prompt, "Use for" selector in editor, platform-specific conventions
- [x] **Phase 3: Smarter AI Generation** â€” Better type selection, full content depth, style cues, fixed clarification threshold, assumption disclosures

## Phase Details

### Phase 1: WYSIWYG Canvas
**Goal**: Editor preview canvas renders at the exact aspect ratio of the selected export preset at all times
**Depends on**: Nothing
**Requirements**: WYSIWYG-01, WYSIWYG-02, WYSIWYG-03, WYSIWYG-04
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. When user selects "Landscape 16:9" preset, the preview canvas container is visibly wider than tall in a 16:9 ratio
  2. When user selects "Story / Reel 9:16", the canvas is visibly taller than wide in a 9:16 ratio
  3. When user selects "Square 1:1", the canvas is a perfect square
  4. The export dimensions label (e.g., "1920Ã—1080") is visible adjacent to the canvas
  5. Canvas aspect ratio updates immediately on preset change without page reload
**Plans**: TBD

Plans:
- [x] 01-01: Canvas container â€” apply aspect-ratio CSS from selected preset, show dimension label
- [x] 01-02: Verify WYSIWYG behavior across all 5 social presets + custom dimensions

### Phase 2: Use-Case Awareness
**Goal**: AI infers target platform from prompt and sets the correct export preset; user can override via a "Use for" selector
**Depends on**: Phase 1
**Requirements**: USECASE-01, USECASE-02, USECASE-03, USECASE-04
**Success Criteria** (what must be TRUE):
  1. Typing "for my pitch deck" in the chat sets the preset to landscape 16:9 automatically
  2. Typing "LinkedIn post" sets it to square 1:1 automatically
  3. The "Use for" selector in the editor shows the currently active use-case
  4. Clicking a different option in the "Use for" selector overrides the AI-inferred preset
  5. A diagram generated for "presentation" uses fewer nodes and larger text than one generated for "documentation"
**Plans**: TBD

Plans:
- [x] 02-01: Use-case inference â€” extract platform keywords in intent planning, map to preset IDs + style mode
- [x] 02-02: "Use for" selector UI â€” dropdown in editor, pre-filled from AI inference, overrides preset
- [x] 02-03: Style-mode conventions â€” update generation prompts to apply presentation/social/docs conventions

### Phase 3: Smarter AI Generation
**Goal**: AI reliably picks the right diagram type, extracts full content depth, respects style cues, and generates immediately unless truly ambiguous
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. "OAuth login flow between browser, API, and auth server" generates a sequenceDiagram, not a flowchart
  2. "Database schema for a blog with users, posts, and comments" generates an erDiagram with all three entities and their relationships
  3. "Simple overview for a README" generates a minimal-node diagram vs "detailed architecture for documentation" generates a dense one
  4. A 5-word prompt generates a diagram immediately without asking a clarification question
  5. After a silent generation, a dismissible notice appears showing: "Generated as: sequenceDiagram Â· Landscape 16:9 Â· Medium detail"
**Plans**: TBD

Plans:
- [x] 03-01: System prompt overhaul â€” rewrite DIAGRAM_SYSTEM_PROMPTS for all 7 types with type-selection decision rules and content depth guidelines
- [x] 03-02: Intent pipeline fixes â€” raise clarification threshold to ambiguityScore â‰¥ 90, pass full IntentPlan to generation prompt
- [x] 03-03: Assumption disclosure â€” render dismissible notice in editor chat after silent generation

---

# Milestone 1.1 â€” AI Iteration & Sharing

Detailed plan: `.planning/phases/MILESTONE-1.1.md`

- [x] **Phase 4: Surgical AI Edits** â€” follow-up prompts patch the existing diagram; "Regenerate" toggle for full rebuild
- [x] **Phase 5: Persistent Version History** â€” auto-labeled revisions surfaced as a History dropdown with click-to-restore
- [x] **Phase 6: Public Share with OG Previews** â€” `/s/[token]` HTML viewer + branded 1200Ã—630 og:image + proper 404

---

# Milestone 1.2 â€” Brand & Distribution

Detailed plan: `.planning/phases/MILESTONE-1.2.md`

- [x] **Phase 7: Brand Kit** â€” workspace-scoped CRUD + settings UI; one-click apply in the editor writes the palette into the active diagram
- [x] **Phase 8: Iframe Embeds** â€” chromeless `/embed/[token]` viewer + "Embed" button copies a paste-ready iframe snippet

---

# Milestone 1.3 â€” Legendary (in progress)

- [x] **Phase 9: Real OG Previews** â€” client captures a PNG at share-create time; OG route serves the actual diagram, not a generic card
- [x] **Phase 10: Streaming Live Preview** â€” added the missing Mermaid live preview AND made it streaming-aware (parse-gate, last-good fallback, debounce)
- [x] **Phase 11: AI-aware Brand Kit + Templates Gallery** â€” AI injects workspace brand palette into generation prompts; `/app/templates` ships with 6 curated starters that fork into a new project on click

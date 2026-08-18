# Requirements: Flowchart AI — Diagram Platform

> **⚠️ SUPERSEDED (2026-08-17).** Historical record of the pre-single-engine product's
> requirements (multi-renderer product: Mermaid, Excalidraw, ReactFlow, ECharts, Nivo,
> TLDraw, BPMN). Current source of truth: `CLAUDE.md`.

**Defined:** April 13, 2026
**Core Value:** Preview canvas must always show exactly what the export will look like — correct aspect ratio, correct density, no surprises.

## v1 Requirements

### WYSIWYG Preview

- [ ] **WYSIWYG-01**: Editor preview canvas renders at the exact aspect ratio of the selected export preset at all times
- [ ] **WYSIWYG-02**: When no preset is selected (custom), the canvas defaults to a 16:9 aspect ratio container
- [ ] **WYSIWYG-03**: Canvas aspect ratio updates immediately when the user changes the export preset or custom dimensions
- [ ] **WYSIWYG-04**: The preset/size label (e.g., "1920×1080 — Landscape 16:9") is visible adjacent to the preview

### Use-Case Awareness

- [ ] **USECASE-01**: AI infers target platform from prompt keywords and sets the export preset automatically ("pitch deck" → landscape 16:9, "LinkedIn post" → square 1:1, "README" → mermaid/default, "story" → 9:16)
- [ ] **USECASE-02**: Editor exposes a "Use for" selector (Presentation / Social / Documentation / Print / Custom) that overrides the AI-inferred preset
- [ ] **USECASE-03**: AI adjusts diagram style conventions based on the resolved use-case (Presentation → fewer nodes, larger text; Documentation → more detail; Social → minimal labels)
- [ ] **USECASE-04**: AI-inferred use-case is pre-filled in the "Use for" selector so user can see and override it

### Smarter AI Generation

- [ ] **AI-01**: AI selects the most semantically appropriate Mermaid subtype or diagram renderer for the user's description (sequence diagram for actor interactions, ERD for data models, gantt for timelines, etc.)
- [ ] **AI-02**: AI extracts and includes all named entities, steps, actors, and relationships from the user's description in the generated output
- [ ] **AI-03**: AI respects explicit style cues in the prompt ("simple", "professional", "detailed", "for a presentation") and modulates diagram density and label verbosity accordingly
- [ ] **AI-04**: Clarification question is asked at most once per generation, only when `ambiguityScore ≥ 90`; all other prompts generate immediately
- [ ] **AI-05**: When generating without asking, AI renders a dismissible assumption notice showing: inferred diagram type, applied preset, and detail level

## v2 Requirements

### Enhanced Presets

- **PRESET-01**: User can save custom "Use for" configurations (name + dimensions + style preferences) as personally reusable presets
- **PRESET-02**: Preset includes DPI setting for print exports

### Multi-diagram Batch

- **BATCH-01**: User can generate multiple diagram variation sizes in one click (e.g., both 16:9 and 1:1 versions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New diagram renderer types | Existing 7 cover all use cases; additions delay core improvements |
| Auth, billing, DB schema changes | These work correctly; out of scope for this milestone |
| Real-time collaboration | Different product track; introduces significant complexity |
| Rewriting AI pipeline architecture | 2-pass pipeline is solid; improve prompts and thresholds only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WYSIWYG-01 | Phase 1 | Pending |
| WYSIWYG-02 | Phase 1 | Pending |
| WYSIWYG-03 | Phase 1 | Pending |
| WYSIWYG-04 | Phase 1 | Pending |
| USECASE-01 | Phase 2 | Pending |
| USECASE-02 | Phase 2 | Pending |
| USECASE-03 | Phase 2 | Pending |
| USECASE-04 | Phase 2 | Pending |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 3 | Pending |
| AI-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: April 13, 2026*
*Last updated: April 13, 2026 after initialization*

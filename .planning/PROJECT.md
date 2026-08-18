# Flowchart AI — Diagram Platform

> **⚠️ SUPERSEDED (2026-08-17).** Historical record of the pre-single-engine product
> (7 renderer types). The app is now one AI-native freeform canvas engine — see
> `CLAUDE.md` for the current product description, stack, and architecture.

## What This Is

A web-based diagram platform where users describe what they want in plain text and an AI assistant generates the correct diagram type at the right size for their intended use. Supports 7 renderer types (Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, TLDraw, BPMN) and exports to PNG/SVG at exact output dimensions. Targeted at developers, designers, and business users who need precise, publication-ready diagrams fast.

## Core Value

The preview canvas must always show exactly what the export will look like — correct aspect ratio, correct density, no surprises.

## Requirements

### Validated

- ✓ User can generate diagrams from text using AI — existing
- ✓ App supports 7 diagram types (Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, TLDraw, BPMN) — existing
- ✓ User can export diagrams as PNG and SVG — existing
- ✓ User can set output size via social presets (landscape, square, story, OG, etc.) — existing
- ✓ User can save and load projects — existing
- ✓ User can share diagrams via link — existing
- ✓ Multi-provider AI support (OpenAI, Anthropic, Google, Groq, Mistral) — existing
- ✓ Auth, billing (Stripe), rate limiting — existing

### Active

- [ ] AI correctly selects the diagram type that best fits the user's intent (sequence not flowchart for interaction flows, ERD not flowchart for data models, etc.)
- [ ] AI extracts full depth from user descriptions — all named entities, relationships, steps, and actors appear in the output
- [ ] AI respects style cues — "simple", "professional", "for a presentation" changes density, labels, and layout
- [ ] AI infers target platform from prompt keywords ("pitch deck" → landscape 16:9, "LinkedIn" → square, "README" → mermaid simple)
- [ ] User can manually set/override the intended use-case via a "Use for" selector in the editor (Presentation / Social / Documentation / Print / Custom)
- [ ] AI asks at most one clarification question when ambiguity is genuinely unresolvable; otherwise generates immediately
- [ ] Editor preview canvas renders at the exact aspect ratio of the selected export preset (WYSIWYG)
- [ ] AI shows what it assumed (diagram type, size preset, detail level) as a dismissible notice after silent generation

### Out of Scope

- Adding new diagram renderer types — existing 7 cover all use cases; adding more delays core improvements
- Rewriting auth, billing, or DB schema — these work; don't touch them
- Real-time collaboration — different product track

## Context

- Monorepo: `apps/web` (Next.js 15 App Router) + `packages/core` (shared types/schemas/prompts)
- AI pipeline: `POST /api/ai/generate` → intent planning (LLM pass 1) → generation (LLM pass 2) → validation → retry
- `IntentPlan` in `route.ts` already extracts entities, steps, relationships, ambiguityScore — but these aren't being used maximally in the generation prompt
- `shouldAskClarification` triggers at `ambiguityScore >= 75` — threshold is too low; should be ≥ 90 with a single targeted question
- Social presets live in `packages/core/src/social-presets.ts`; editor canvas size doesn't currently reflect the selected preset aspect ratio
- The `DIAGRAM_SYSTEM_PROMPTS` in `packages/core/src/diagram-types.ts` drive AI output quality — this is the highest-leverage file for type selection and depth

## Constraints

- **Stack**: Next.js 15, TypeScript, Tailwind CSS, Drizzle ORM, Vercel AI SDK — no changes to these
- **Architecture**: Improve existing files; don't restructure routes or component hierarchy
- **Backward compat**: All changes to `DIAGRAM_SYSTEM_PROMPTS` and intent pipeline must not break existing saved projects
- **Performance**: Intent planning LLM call must stay ≤ 2s; no additional sequential LLM calls added

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Improve existing AI pipeline, not replace | `IntentPlan` + 2-pass generation is solid; fix the prompts and thresholds | — Pending |
| Use-case selector drives both preset and generation style | Single source of truth for "what this diagram is for" | — Pending |
| WYSIWYG via CSS aspect-ratio on canvas container | No canvas resizing needed — correct aspect ratio via CSS, export at full resolution | — Pending |
| Clarification threshold raised to ambiguityScore ≥ 90 | Almost all prompts should generate directly; user iterates via chat | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: April 13, 2026 after initialization*

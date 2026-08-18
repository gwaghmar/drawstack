---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Agent Mode Polish
status: All phases complete
last_updated: "2026-06-14T00:00:00.000Z"
progress:
  total_phases: 16
  completed_phases: 16
  percent: 100
---

# Project State

> **⚠️ SUPERSEDED (2026-08-17).** Everything below is historical record of the
> pre-single-engine product (7 renderer types: Mermaid, Excalidraw, ReactFlow, ECharts,
> Nivo, TLDraw/freeform, BPMN). That product no longer exists — the app is a single
> freeform-canvas engine now, and has grown far past milestone 1.6 besides. Current
> source of truth: `CLAUDE.md` (architecture, conventions, known issues) and
> `docs/planning/freeform-canvas-engine-plan.md` (canvas engine history + STATUS UPDATE).
> Don't update the phase table below to reflect new work — it's a closed record of an
> earlier era; add new status to the docs above instead.

## Current Position (as of milestone 1.6, pre-pivot — see notice above)

**Milestone 1.0** — AI Diagram Quality & Precision — DONE
**Milestone 1.1** — AI Iteration & Sharing — DONE
**Milestone 1.2** — Brand & Distribution — DONE
**Milestone 1.3** — Legendary — DONE
**Milestone 1.4** — Social Card Engine — DONE
**Milestone 1.5** — Social Card Suite Expansion — DONE
**Milestone 1.6** — Agent Mode Polish — DONE

## Phase Status

| Phase | Name | Milestone | Status |
|-------|------|-----------|--------|
| 1 | WYSIWYG Canvas | 1.0 | ✅ Complete |
| 2 | Use-Case Awareness | 1.0 | ✅ Complete |
| 3 | Smarter AI Generation | 1.0 | ✅ Complete |
| 4 | Surgical AI Edits | 1.1 | ✅ Complete |
| 5 | Persistent Version History | 1.1 | ✅ Complete |
| 6 | Public Share with OG Previews | 1.1 | ✅ Complete |
| 7 | Brand Kit | 1.2 | ✅ Complete |
| 8 | Iframe Embeds | 1.2 | ✅ Complete |
| 9 | Real OG Previews | 1.3 | ✅ Complete |
| 10 | Streaming Preview | 1.3 | ✅ Complete |
| 11 | AI-Aware Brand & Templates | 1.3 | ✅ Complete |
| 12 | Editor Audit & Polish | 1.3 | ✅ Complete |
| 13 | Social Card Engine | 1.4 | ✅ Complete |
| 14 | Fun Pack | 1.5 | ✅ Complete |
| 15 | Personal & Games | 1.5 | ✅ Complete |
| 16 | Agent Mode Polish | 1.6 | ✅ Complete |

## Decisions

| ID | Decision | Context |
|----|----------|---------|
| D-01 | Improve existing AI pipeline; don't replace | 2-pass intent+generate is solid; fix prompts and thresholds |
| D-02 | WYSIWYG via CSS aspect-ratio on canvas container | No canvas resizing needed; export still runs at full resolution |
| D-03 | Clarification threshold raised to ambiguityScore ≥ 90 | Almost all prompts should generate directly |
| D-04 | Use-case drives both preset AND generation style | Single source of truth for "what this diagram is for" |
| D-05 | All diagram-type prompts get selection rules + extraction checklists + few-shots | Bring all 7 up to Mermaid's quality |
| D-06 | Assumption banner is separate from chat assistantMessage | Both surfaces have a role |
| D-07 | Social card icons must be distinct per type | bingo uses Hash, not LayoutGrid (which alignment already uses) |
| D-08 | Agent Mode routes per-request via prepareSendMessagesRequest({api}) | useChat binds transport once; a useMemo keyed on isAgentMode never re-routed |
| D-09 | PDF export = client-side raster (jsPDF, PNG→single page) | Vector (svg-to-pdfkit) only works for mermaid; PNG capture is universal across all 22 types. Closes the promised-but-unbuilt Pro feature on the pricing page |

## Pending Todos

- **Dependency version bumps for real vulnerabilities (2026-08-17).** `pnpm audit` is at
  87 (3 critical, 30 high, 46 moderate, 8 low) after removing dead diagram-engine
  packages (down from 122). The remainder is in actively-used packages, so each needs a
  real upgrade + testing pass, not a blind bump:
  - `next-auth` (`5.0.0-beta.25`) + `@auth/core` — 3 critical + 2 high + 3 moderate. Test
    the full login flow (mock-auth and real Supabase) after upgrading.
  - `next` (`16.2.7`) — 4 high + 5 moderate. Test build + core routes after upgrading.
  - `hono` (22 combined, via `@modelcontextprotocol/sdk@1.29.0`) — bump the SDK version
    and re-test the MCP endpoint (`generate_diagram`, `apply_ops`, `list_diagram_types`)
    end-to-end via direct JSON-RPC calls, same pattern used to verify `apply_ops` when it
    shipped.
- `apps/web/.env` Google AI key is invalid — set a valid key to run the live agent tool-card verifier (`RUN_AGENT_VERIFY=1 pnpm exec playwright test agent-mode-verify`)
- PDF export embeds a high-res PNG (pixelRatio = pngScale) → files can be large (~10MB for a tall diagram at scale 2). Follow-up if size matters: JPEG-encode or cap the PDF pixelRatio.
- `validateAndRepairOutput` lives in `lib/diagrams/validate-output.ts` (shared by generate + agent routes); agent `update_diagram` validates and self-corrects within its 5-step loop. apply_patch/update_node results are applied client-side and not server-validated (lower risk — surgical edits)

## Blockers

(None)

---
*Last updated: June 12, 2026 after Phase 15 completion*

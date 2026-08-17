# Project: Gemini CLI Workspace

Project facts, stack, architecture, and current work status live in `AGENTS.md`
(tool-agnostic) and `docs/planning/freeform-canvas-engine-plan.md` (canvas work
in progress — read its STATUS section before touching that area). This file is
process/workflow guidance only.

## Operating Principles (do this every time)
- Do NOT ask for code first. Start by creating a plan.
- Use collaboration over YOLO:
  - Propose changes
  - Ask what to do next if anything is unclear
- Avoid drive-by refactors. Only touch what the task requires.
- Prefer small diffs, then verify.
- **Supabase Mandate:** If a project uses Supabase, always prioritize proper CLI setup and environment configuration (DATABASE_URL, SUPABASE_URL, ANON_KEY) over mock implementations. Use the Supabase CLI to verify connectivity and retrieve project status.
## Task Execution Loop (must follow)
1. Plan: list steps to implement the task.
2. Files: identify what files you will read/modify.
3. Implement: apply the plan in small chunks.
4. Verify: run tests / check outputs (or suggest the commands to run).
5. Fix: iterate until verification is green.
## Quality Bar
- If you add/modify logic, also add/modify tests when possible.
- If something fails, diagnose root cause, then patch and re-verify.

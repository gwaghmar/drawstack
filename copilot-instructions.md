<!-- GSD:project-start source:PROJECT.md -->
## Project

**Flowchart AI — Diagram Platform**

A web-based diagram platform where users describe what they want in plain text and an AI assistant generates the correct diagram type at the right size for their intended use. Supports 7 renderer types (Mermaid, Excalidraw, ReactFlow, ECharts, Nivo, TLDraw, BPMN) and exports to PNG/SVG at exact output dimensions. Targeted at developers, designers, and business users who need precise, publication-ready diagrams fast.

**Core Value:** The preview canvas must always show exactly what the export will look like — correct aspect ratio, correct density, no surprises.

### Constraints

- **Stack**: Next.js 15, TypeScript, Tailwind CSS, Drizzle ORM, Vercel AI SDK — no changes to these
- **Architecture**: Improve existing files; don't restructure routes or component hierarchy
- **Backward compat**: All changes to `DIAGRAM_SYSTEM_PROMPTS` and intent pipeline must not break existing saved projects
- **Performance**: Intent planning LLM call must stay ≤ 2s; no additional sequential LLM calls added
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7.2 - All application code across web, core, and mcp-server packages
- Python 3.x - Test scripts (`test_ai_key.py`, `test_browser.py`, `test_editor.py` at project root)
## Runtime
- Node.js >= 20 (enforced in `package.json` engines field)
- pnpm (with workspace support)
- Lockfile: `pnpm-lock.yaml` present
- Workspace config: `pnpm-workspace.yaml` defines `apps/*` and `packages/*`
## Monorepo Structure
- `apps/web` (`@flowchart/web`) - Next.js web application
- `packages/core` (`@flowchart/core`) - Shared types and schemas, ESM-only, built with tsup
- `packages/mcp-server` (`@flowchart/mcp-server`) - Standalone MCP server, ESM-only, built with tsup
## Frameworks
- Next.js 15.1.6 (`apps/web`) - App Router, Turbopack for dev (`next dev --turbopack -p 3040`), Server Actions enabled
- React 19.0.0 - UI library
- Tailwind CSS 3.4.17 (`apps/web/tailwind.config.ts`) - Utility-first CSS with Geist font family
- Vercel AI SDK (`ai` ^6.0.156) - Core AI streaming SDK with multi-provider support
- `@ai-sdk/openai` ^3.0.52 - OpenAI + compatible (Ollama, custom endpoints)
- `@ai-sdk/anthropic` ^3.0.68 - Anthropic Claude
- `@ai-sdk/google` ^3.0.61 - Google Gemini
- `@ai-sdk/mistral` ^3.0.30 - Mistral AI
- `@ai-sdk/groq` ^3.0.35 - Groq
- Drizzle ORM 0.38.4 - Type-safe ORM with PostgreSQL dialect
- drizzle-kit 0.30.1 - Schema migrations (`apps/web/drizzle.config.ts`)
- postgres.js 3.4.5 - PostgreSQL driver (`apps/web/lib/db/index.ts`)
- Playwright 1.49.1 - E2E testing only (`playwright.config.ts` at root, tests in `e2e/`)
- No unit test framework detected
- tsup 8.3.5 - Builds `@flowchart/core` and `@flowchart/mcp-server` packages
- tsx 4.19.2 - Dev runner for mcp-server (`tsx watch src/index.ts`)
## Key Dependencies
- `mermaid` ^11.4.1 - Mermaid diagram renderer
- `@xyflow/react` ^12.10.2 - React Flow for node-graph diagrams
- `tldraw` ^4.5.8 - Infinite canvas / freehand drawing
- `@excalidraw/excalidraw` ^0.18.0 - Excalidraw whiteboard
- `bpmn-js` ^18.14.0 - BPMN process diagrams
- `@dagrejs/dagre` ^3.0.0 - Directed graph layout engine
- `@mermaid-js/mermaid-cli` ^11.12.0 - Server-side Mermaid rendering
- `@nivo/bar`, `@nivo/line`, `@nivo/pie`, `@nivo/network`, `@nivo/sankey`, `@nivo/radar`, `@nivo/treemap` (all ^0.99.0)
- `echarts` ^5.5.0 + `echarts-for-react` ^3.0.6
- `pdfkit` ^0.18.0 - PDF generation
- `svg-to-pdfkit` ^0.1.8 - SVG embed in PDF
- `html-to-image` ^1.11.11 - HTML/SVG → PNG/JPEG
- `jszip` ^3.10.1 - ZIP archive creation
- `sharp` ^0.34.5 - Image processing
- `@supabase/supabase-js` ^2.103.0 - Supabase client
- `@supabase/ssr` ^0.10.2 - Supabase SSR helpers for Next.js
- `next-auth` 5.0.0-beta.25 - Legacy stub only (replaced by Supabase Auth)
- `stripe` ^17.6.0 - Stripe Payments SDK
- `@modelcontextprotocol/sdk` ^1.29.0 - Model Context Protocol server/transport
- `zod` ^3.24.1 - Schema validation (used in core, web, mcp-server)
- `nanoid` ^5.1.7 - ID generation
- `jsonrepair` ^3.13.3 - JSON repair for AI outputs
- `lucide-react` ^1.8.0 - Icon library
## Configuration
- `apps/web/tsconfig.json` - Strict mode, `@/*` path alias mapping to `apps/web/*`, ES2017 target, bundler module resolution
- `packages/core/tsconfig.json` - ESM module output
- `packages/mcp-server/tsconfig.json` - ESM module output
- `apps/web/next.config.ts` - Transpiles `@flowchart/core`, serverActions bodySizeLimit 2mb
- `packages/core`: `tsup src/index.ts --format esm --dts --clean`
- `packages/mcp-server`: `tsup src/index.ts --format esm --clean`
- Root `.env.example` documents all required vars
- Web app loads `.env.local` then `.env` (via dotenv in drizzle.config.ts)
- Supabase vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Database: `DATABASE_URL` (PostgreSQL connection string)
- `apps/web/tailwind.config.ts` - Content paths for `app/` and `components/`, Geist font vars, custom `fade-in` animation
- `apps/web/postcss.config.mjs` - PostCSS with Autoprefixer
## Platform Requirements
- Node.js >= 20
- pnpm workspace
- PostgreSQL instance (local or Supabase) for `DATABASE_URL`
- Dev server runs on port 3040
- Vercel (`apps/web/vercel.json` - custom install/build commands)
- PostgreSQL via Supabase (with connection pooler for serverless)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: `kebab-case.tsx` — e.g., `editor-client.tsx`, `share-viewer.tsx`, `diagram-icon.tsx`
- API route handlers: `route.ts` inside nested directories under `app/api/`
- Server actions: `kebab-case.ts` in `app/actions/` — e.g., `project.ts`, `login.ts`, `api-keys.ts`
- Lib utilities: `kebab-case.ts` in `apps/web/lib/` — e.g., `ai-providers.ts`, `rate-limit.ts`
- Zod schema files: `schemas.ts` inside packages
- camelCase for all functions: `listProjects`, `createProject`, `getPrincipalFromRequest`, `demoSignIn`
- Async functions used extensively (all DB operations and server actions are `async`)
- Private/internal helpers not exported explicitly stay at module scope
- camelCase for variables and object keys
- Boolean flags: `ok`, `isActive`, `inString`, `escape` (short idiomatic names in low-scope code)
- PascalCase for all types and interfaces: `ApiPrincipal`, `DiagramType`, `ProviderMeta`, `ChatTurn`
- Zod schemas: `PascalCase` + `Schema` suffix — `MermaidSourceSchema`, `ApiErrorSchema`, `ExportOptionsSchema`
- Type aliases derived from Zod with `z.infer<typeof Schema>`: `type ApiError = z.infer<typeof ApiErrorSchema>`
- `type` keyword preferred over `interface` throughout
- SCREAMING_SNAKE_CASE for module-level constants: `DIAGRAM_TYPE_META`, `PROVIDER_META`, `THEMES`, `SOCIAL_PRESETS`, `DIAGRAM_SYSTEM_PROMPTS`
## Code Style
- No `.prettierrc` found in project root — relies on editor defaults + ESLint
- Double quotes for strings in TypeScript/TSX
- Semicolons used
- Tool: ESLint with flat config — `apps/web/eslint.config.mjs`
- Extends: `next/core-web-vitals` and `next/typescript`
- Ignores: `.next/**`, `node_modules/**`, `dist/**`, `next-env.d.ts`
- Deliberate suppression: `// eslint-disable-next-line @typescript-eslint/no-require-imports` used for CommonJS interop in `apps/web/app/api/v1/export/route.ts`
- `strict: true` in all tsconfigs
- Target: `ES2017` for web app, `ES2022` for packages
- Path alias `@/*` maps to project root in `apps/web/tsconfig.json`
- `import type { ... }` used explicitly for type-only imports throughout
## Import Organization
- `@/*` → root of `apps/web/` (e.g., `@/lib/db`, `@/auth`, `@/components/diagram-icon`)
- `@flowchart/core` → shared types, schemas, themes, templates
- `@flowchart/web` → web app package (used in pnpm filter commands)
- All source is ESM (`import`/`export`)
- Single deliberate CJS exception: `require("svg-to-pdfkit")` in `apps/web/app/api/v1/export/route.ts` with explicit eslint-disable comment
## Directives
- `"use client"` at top of files with hooks, browser state, or interactive UI — e.g., `apps/web/components/editor-client.tsx`
- `"use server"` at top of server action files — e.g., `apps/web/app/actions/project.ts`, `apps/web/app/actions/login.ts`
## Error Handling
- All error payloads typed as `ApiError` from `@flowchart/core`
- Error codes are a Zod enum defined in `packages/core/src/schemas.ts`: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `ENTITLEMENT_REQUIRED`, `INSUFFICIENT_CREDITS`, `EXPORT_TIMEOUT`, `INTERNAL_ERROR`
- HTTP status codes consistent: 400 validation, 401 auth, 402 entitlement, 429 rate limit, 500 internal
- Empty catch blocks `catch {}` used when the error is intentionally discarded
- `catch (e)` used when error message is forwarded: `e instanceof Error ? e.message : "Invalid body"`
## Validation
- `.parse()` throws on failure (caught by surrounding try-catch)
- Schema constraints inline: `.min(1)`, `.max(500_000)`, `.int().positive().max(8192)`
## Logging
- Prefixed with bracketed context tag: `console.error("[AI generate error]", e)`, `console.error("[ensureUserAndWorkspace]", e)`
- Errors logged only, no debug/info logging in production paths
## Comments
- Used at top of `packages/cli/src/index.ts` to document CLI usage and configuration
- Inline type comments on schema fields and diagram type definitions (e.g., `// Text-based: flowchart…`)
- Non-obvious decisions explained inline: `// Prefer Enter to submit — button click alone may not complete the server action`
- `// eslint-disable-next-line` always accompanied by rule name
## Module Design
- Named exports for all functions and constants
- Default exports only for config objects (`export default eslintConfig`, `export default defineConfig(...)`)
- `packages/core/src/index.ts` re-exports everything: `export * from "./schemas.js"`
- No barrel files inside `apps/web/` — imports go directly to module files
## Database Access
- Limit-1 queries destructured: `const [p] = await db.select()...limit(1)`
- IDs generated with `crypto.randomUUID()`
- Timestamps use `new Date()` assigned to variable and reused for consistency within a transaction
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Server Components handle auth, data fetching, and initial render; Client Components handle interactive editor canvas
- Server Actions (not REST) used for all authenticated mutations (CRUD)
- Multi-tenant data model: User → Workspace → Projects
- Dual authentication: Supabase session cookies for web users; hashed Bearer API keys (`fc_…`) for programmatic access
- Shared `@flowchart/core` package provides domain types, schemas, themes, and templates to all consumers (web, CLI, MCP server)
## Layers
- Purpose: Single source of truth for domain types, Zod schemas, diagram metadata, themes, templates, presets
- Location: `packages/core/src/`
- Contains: `diagram-types.ts`, `schemas.ts`, `themes.ts`, `templates.ts`, `social-presets.ts`
- Depends on: Zod only
- Used by: `apps/web`, `packages/cli`, `packages/mcp-server`
- Purpose: Supabase session refresh on every request; route protection for `/app/*`
- Location: `apps/web/middleware.ts`
- Contains: Auth guard that redirects unauthenticated requests to `/login?callbackUrl=…`
- Depends on: `lib/supabase/middleware.ts`
- Purpose: Data loading, auth checks, hydrating Client Components with props
- Location: `apps/web/app/` (all `page.tsx` and `layout.tsx` files)
- Contains: Dashboard (`app/app/page.tsx`), Editor (`app/app/editor/page.tsx`), Admin (`app/app/admin/page.tsx`), Billing, Settings
- Depends on: `auth.ts`, Server Actions, `lib/` utilities
- Used by: Rendered by Next.js on request
- Purpose: Authenticated database mutations invoked directly from Server or Client Components
- Location: `apps/web/app/actions/`
- Contains: `project.ts`, `share.ts`, `login.ts`, `api-keys.ts`
- Pattern: Each action calls `auth()`, resolves workspace, then queries `db`
- Depends on: `auth.ts`, `lib/db`, `lib/user-sync.ts`
- Purpose: External HTTP endpoints (AI generation, v1 REST, billing webhooks, MCP, share tokens)
- Location: `apps/web/app/api/`
- Contains: `ai/generate/`, `ai/agent/`, `ai/engine-v2/`, `ai/demo/`, `v1/validate/`, `api/mcp/`, `billing/checkout/`, `billing/portal/`, `webhooks/stripe/`, `share/[token]/`, `auth/`
- Auth: `lib/api-auth.ts` (`getPrincipalFromRequest`) for v1 endpoints; `auth()` for session-only endpoints
- Depends on: `lib/db`, `@flowchart/core`, Stripe SDK, Vercel AI SDK
- Purpose: Reusable server-side utilities — database client, auth helpers, business logic
- Location: `apps/web/lib/`
- Contains:
- Purpose: Interactive editor (code editor, live preview, export controls, AI assistant)
- Location: `apps/web/components/`
- Contains: `editor-client.tsx` (main editor shell), `diagrams/`, `engine-v2/`, `diagram-icon.tsx`, `share-viewer.tsx`
- Pattern: Heavy use of `dynamic()` with `ssr: false` for diagram renderers that require browser APIs
- Depends on: `@flowchart/core`, Server Actions (called via import)
- Purpose: MCP stdio transport for AI IDEs (Cursor, Claude Code) — runs as a separate process
- Location: `packages/mcp-server/src/index.ts`
- Contains: MCP tools (`diagram_set_source`, `diagram_apply_theme`, `diagram_list_templates`)
- Depends on: `@flowchart/core`, `@modelcontextprotocol/sdk`
- Purpose: Terminal tool to generate diagrams via the web API
- Location: `packages/cli/src/index.ts`
- Commands: `generate`, `list-types`
- Depends on: `@flowchart/core`, reads `~/.flowchart/config.json` for API key/baseUrl
## Data Flow
- Server state: PostgreSQL via Drizzle (single source of truth)
- Client state: React `useState`/`useRef` within `EditorClient` — no global client store
- Cache: `revalidatePath` called after mutations to bust Next.js page cache
## Key Abstractions
- Purpose: Unified session shape abstracting Supabase user object
- Examples: `apps/web/auth.ts`
- Pattern: `auth()` async function returns `AuthSession | null`; every server action calls it first
- Purpose: Shared domain constants — diagram types, Zod schemas, themes, templates
- Examples: `packages/core/src/diagram-types.ts`, `packages/core/src/schemas.ts`
- Pattern: Imported by `apps/web`, `packages/cli`, `packages/mcp-server` to ensure consistency
- Purpose: Discriminated union representing either a web session user or a programmatic API key caller
- Examples: `apps/web/lib/api-auth.ts`
- Pattern: `getPrincipalFromRequest(req)` returns `{ type: "user"; userId; plan } | { type: "anonymous" }`
- Purpose: Lazy singleton database client that defers connection until first query (allows `next build` without `DATABASE_URL`)
- Examples: `apps/web/lib/db/index.ts`
- Pattern: `Proxy` wrapping `drizzle(postgres(DATABASE_URL))` with connection pooling via `postgres` (`max: 1`)
- Purpose: Exposes AI diagram generation as an MCP tool over HTTP (Streamable HTTP transport) in addition to the standalone stdio server
- Examples: `apps/web/app/api/mcp/route.ts`
- Pattern: Stateless — each request creates a fresh `Server` instance
## Entry Points
- Location: `apps/web/app/layout.tsx`
- Triggers: Next.js App Router; HTML shell with global fonts and CSS
- Responsibilities: Root HTML document, font variables, global stylesheet
- Location: `apps/web/app/app/layout.tsx`
- Triggers: Any route under `/app/`
- Responsibilities: Session check, `ensureUserAndWorkspace`, nav header with credits display
- Location: `packages/mcp-server/src/index.ts`
- Triggers: `node index.js` (stdio transport)
- Responsibilities: Exposes `diagram_set_source`, `diagram_apply_theme`, `diagram_list_templates` MCP tools
- Location: `packages/cli/src/index.ts`
- Triggers: `npx @flowchart/cli generate "…"`
- Responsibilities: Reads `~/.flowchart/config.json`, calls web API, writes output
## Error Handling
- API routes return `NextResponse.json({ error, code }, { status })` using `ErrorCode` enum from `packages/core/src/schemas.ts`
- Server Actions throw `Error` (caught by Next.js error boundaries or caller)
- `db` client throws on missing `DATABASE_URL`; `app/app/layout.tsx` catches and renders an inline warning banner rather than crashing
- Rate limiting via `rateLimit(key, limit, windowMs)` in `lib/rate-limit.ts`; returns `429` on breach
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.github/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

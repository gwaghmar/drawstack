import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", {
    withTimezone: true,
    mode: "date",
  }),
  image: text("image"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").notNull().default("free"),
  role: text("role").notNull().default("user"),
  creditsBalance: integer("credits_balance").notNull().default(5),
  handle: text("handle").unique(),
}, () => [
  check("user_plan_chk", sql`plan IN ('free', 'pro')`),
  check("user_role_chk", sql`role IN ('user', 'admin')`),
]).enableRLS();

export const workspaces = pgTable("workspace", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [index("workspace_owner_idx").on(t.ownerId)]).enableRLS();

export const projects = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source").notNull(),
  themeId: text("theme_id").notNull().default("stage_pipeline"),
  diagramType: text("diagram_type").notNull().default("freeform"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [index("project_workspace_idx").on(t.workspaceId)]).enableRLS();

export const revisions = pgTable("revision", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by").references(() => users.id),
}, (t) => [index("revision_project_idx").on(t.projectId)]).enableRLS();

export const shareLinks = pgTable("share_link", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  // PNG data URL captured client-side at share-create time, used by the OG
  // image route to render a real preview of the diagram (vs a generic card).
  previewDataUrl: text("preview_data_url"),
  rawToken: text("raw_token"),
}, (t) => [index("share_link_project_idx").on(t.projectId)]).enableRLS();

export const apiKeys = pgTable("api_key", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [index("api_key_user_idx").on(t.userId), index("api_key_hash_idx").on(t.keyHash)]).enableRLS();

export const brandKits = pgTable("brand_kit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  paletteJson: text("palette_json"),
  logoObjectKey: text("logo_object_key"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [index("brand_kit_workspace_idx").on(t.workspaceId)]).enableRLS();

export const aiEvents = pgTable("ai_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  diagramType: text("diagram_type").notNull(),
  effectiveDiagramType: text("effective_diagram_type").notNull(),
  typeSwitched: boolean("type_switched").notNull().default(false),
  mode: text("mode").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptLength: integer("prompt_length").notNull().default(0),
  sourceLength: integer("source_length").notNull().default(0),
  intentLatencyMs: integer("intent_latency_ms"),
  genLatencyMs: integer("gen_latency_ms"),
  totalLatencyMs: integer("total_latency_ms").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  toolCalls: integer("tool_calls"),
  validationStatus: text("validation_status").notNull(),
  retryAttempted: boolean("retry_attempted").notNull().default(false),
  intentFallback: boolean("intent_fallback").notNull().default(false),
  error: text("error"),
}, (t) => [
  index("ai_event_user_idx").on(t.userId),
  index("ai_event_created_idx").on(t.createdAt),
  check("ai_event_mode_chk", sql`mode IN ('patch', 'create', 'agent')`),
  check("ai_event_validation_chk", sql`validation_status IN ('ok', 'repaired', 'failed_after_retry', 'error')`),
]).enableRLS();

export const exportJobs = pgTable("export_job", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("queued"),
  type: text("type").notNull(),
  inputHash: text("input_hash"),
  resultUrl: text("result_url"),
  errorDetail: text("error_detail"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("export_job_user_idx").on(t.userId),
  check("export_job_status_chk", sql`status IN ('queued', 'processing', 'done', 'failed')`),
]).enableRLS();

export const passkeyCredentials = pgTable("passkey_credential", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  credentialPublicKey: text("credential_public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  aaguid: text("aaguid"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("passkey_credential_user_idx").on(t.userId),
  index("passkey_credential_id_idx").on(t.credentialId),
]).enableRLS();

export const passkeyChallenge = pgTable("passkey_challenge", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  type: text("type").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("passkey_challenge_user_idx").on(t.userId),
  check("passkey_challenge_type_chk", sql`type IN ('registration', 'authentication')`),
]).enableRLS();

export const projectCollaborators = pgTable("project_collaborator", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("editor"),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("project_collaborator_project_idx").on(t.projectId),
  index("project_collaborator_user_idx").on(t.userId),
  check("project_collaborator_role_chk", sql`role IN ('viewer', 'editor', 'admin')`),
]).enableRLS();

export const projectEdits = pgTable("project_edit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  operation: text("operation").notNull(),
  operationData: text("operation_data").notNull(),
  clientId: text("client_id").notNull(),
  lamportTimestamp: integer("lamport_timestamp").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("project_edit_project_idx").on(t.projectId),
  index("project_edit_created_idx").on(t.createdAt),
]).enableRLS();

export const collaboratorPresence = pgTable("collaborator_presence", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  cursorX: integer("cursor_x"),
  cursorY: integer("cursor_y"),
  selectionStart: text("selection_start"),
  selectionEnd: text("selection_end"),
  color: text("color").notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("collaborator_presence_project_idx").on(t.projectId),
  index("collaborator_presence_heartbeat_idx").on(t.lastHeartbeat),
]).enableRLS();

import type { users, workspaces } from "./db/schema.ts";
import { resolveRoleForNewUser } from "./admin.ts";
import { isMockAuthEnabled } from "./auth-mode.ts";

type UserRecord = typeof users.$inferSelect;
type WorkspaceRecord = typeof workspaces.$inferSelect;
type UserRole = "admin" | "user";

type UserCreateValues = Pick<
  typeof users.$inferInsert,
  "email" | "name" | "role"
>;
type WorkspaceCreateValues = Pick<
  typeof workspaces.$inferInsert,
  "name" | "ownerId"
>;

export type UserWorkspaceSyncDeps = {
  selectUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(values: UserCreateValues): Promise<UserRecord>;
  selectWorkspaceByOwnerId(ownerId: string): Promise<WorkspaceRecord | null>;
  createWorkspace(values: WorkspaceCreateValues): Promise<WorkspaceRecord>;
  resolveRole(email: string): UserRole;
};

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

function getMockUserAndWorkspace(email: string) {
  const mockUser = {
    id: "dev-user-id",
    email,
    name: displayNameFromEmail(email),
    plan: "pro",
    role: "admin",
    creditsBalance: 100,
  };
  const mockWorkspace = {
    id: "dev-ws-id",
    name: "Personal",
    ownerId: "dev-user-id",
    createdAt: new Date(0),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { user: mockUser as any, workspace: mockWorkspace as any, isNewUser: false };
}

export async function ensureUserAndWorkspaceCore(
  email: string,
  deps: UserWorkspaceSyncDeps,
) {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await deps.selectUserByEmail(normalizedEmail);
  const isNewUser = !user;

  if (!user) {
    user = await deps.createUser({
      email: normalizedEmail,
      name: displayNameFromEmail(normalizedEmail),
      role: deps.resolveRole(normalizedEmail),
    });
  }

  let workspace = await deps.selectWorkspaceByOwnerId(user.id);
  if (!workspace) {
    workspace = await deps.createWorkspace({
      name: "Personal",
      ownerId: user.id,
    });
  }

  return { user, workspace, isNewUser };
}

export async function ensureUserAndWorkspace(email: string) {
  if (isMockAuthEnabled()) return getMockUserAndWorkspace(email);

  const { eq } = await import("drizzle-orm");
  const { db } = await import("./db");
  const { users: usersTable, workspaces: workspacesTable } = await import("./db/schema");

  return ensureUserAndWorkspaceCore(email, {
    selectUserByEmail: async (userEmail) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, userEmail))
        .limit(1);
      return user ?? null;
    },
    createUser: async (values) => {
      const [user] = await db
        .insert(usersTable)
        .values(values)
        .onConflictDoNothing({ target: usersTable.email })
        .returning();
      if (user) return user;

      // A concurrent request (e.g. the sign-up action and the redirected
      // page render) won the race and inserted this email first.
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, values.email))
        .limit(1);
      if (!existing) throw new Error("Failed to create user");
      return existing;
    },
    selectWorkspaceByOwnerId: async (ownerId) => {
      const [workspace] = await db
        .select()
        .from(workspacesTable)
        .where(eq(workspacesTable.ownerId, ownerId))
        .limit(1);
      return workspace ?? null;
    },
    createWorkspace: async (values) => {
      const [workspace] = await db.insert(workspacesTable).values(values).returning();
      if (!workspace) throw new Error("Failed to create workspace");
      return workspace;
    },
    resolveRole: resolveRoleForNewUser,
  });
}

export async function getUserAndWorkspaceById(userId: string) {
  if (isMockAuthEnabled() && userId === "dev-user-id") {
    return getMockUserAndWorkspace("dev@example.com");
  }

  const { eq } = await import("drizzle-orm");
  const { db } = await import("./db");
  const { users: usersTable, workspaces: workspacesTable } = await import("./db/schema");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;
  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, user.id))
    .limit(1);
  if (!workspace) return null;
  return { user, workspace, isNewUser: false };
}

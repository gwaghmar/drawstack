import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureUserAndWorkspaceCore } from "./user-sync.ts";

describe("ensureUserAndWorkspaceCore", () => {
  it("creates a user and personal workspace when neither exists", async () => {
    const calls: string[] = [];
    const result = await ensureUserAndWorkspaceCore("new@example.com", {
      selectUserByEmail: async () => null,
      createUser: async (values) => {
        calls.push(`createUser:${values.email}:${values.role}`);
        return {
          id: "user-1",
          email: values.email,
          name: values.name ?? null,
          role: values.role ?? "user",
          plan: "free",
          creditsBalance: 5,
          emailVerified: null,
          image: null,
          stripeCustomerId: null,
          handle: null,
        };
      },
      selectWorkspaceByOwnerId: async () => null,
      createWorkspace: async (values) => {
        calls.push(`createWorkspace:${values.ownerId}`);
        return {
          id: "workspace-1",
          name: values.name,
          ownerId: values.ownerId,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        };
      },
      resolveRole: (email) => (email === "new@example.com" ? "admin" : "user"),
    });

    assert.equal(result.user.id, "user-1");
    assert.equal(result.user.role, "admin");
    assert.equal(result.workspace.ownerId, "user-1");
    assert.deepEqual(calls, ["createUser:new@example.com:admin", "createWorkspace:user-1"]);
  });

  it("reuses existing user and workspace", async () => {
    const existingUser = {
      id: "user-2",
      email: "existing@example.com",
      name: "Existing",
      role: "user",
      plan: "pro",
      creditsBalance: 100,
      emailVerified: null,
      image: null,
      stripeCustomerId: null,
      handle: null,
    };
    const existingWorkspace = {
      id: "workspace-2",
      name: "Personal",
      ownerId: "user-2",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };

    const result = await ensureUserAndWorkspaceCore("existing@example.com", {
      selectUserByEmail: async () => existingUser,
      createUser: async () => {
        throw new Error("createUser should not be called");
      },
      selectWorkspaceByOwnerId: async () => existingWorkspace,
      createWorkspace: async () => {
        throw new Error("createWorkspace should not be called");
      },
      resolveRole: () => "user",
    });

    assert.equal(result.user, existingUser);
    assert.equal(result.workspace, existingWorkspace);
  });

  it("returns isNewUser=true when user is created", async () => {
    const result = await ensureUserAndWorkspaceCore("brand-new@example.com", {
      selectUserByEmail: async () => null,
      createUser: async (values) => ({
        id: "user-new",
        email: values.email,
        name: values.name ?? null,
        role: values.role ?? "user",
        plan: "free",
        creditsBalance: 5,
        emailVerified: null,
        image: null,
        stripeCustomerId: null,
        handle: null,
      }),
      selectWorkspaceByOwnerId: async () => null,
      createWorkspace: async (values) => ({
        id: "ws-new",
        name: values.name,
        ownerId: values.ownerId,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
      resolveRole: () => "user",
    });
    assert.equal(result.isNewUser, true);
  });

  it("returns isNewUser=false when user already exists", async () => {
    const existingUser = {
      id: "user-old", email: "old@example.com", name: "Old", role: "user",
      plan: "free", creditsBalance: 5,
      emailVerified: null, image: null, stripeCustomerId: null,
      handle: null,
    };
    const result = await ensureUserAndWorkspaceCore("old@example.com", {
      selectUserByEmail: async () => existingUser,
      createUser: async () => { throw new Error("should not be called"); },
      selectWorkspaceByOwnerId: async () => ({
        id: "ws-old", name: "Personal", ownerId: "user-old",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
      createWorkspace: async () => { throw new Error("should not be called"); },
      resolveRole: () => "user",
    });
    assert.equal(result.isNewUser, false);
  });
});

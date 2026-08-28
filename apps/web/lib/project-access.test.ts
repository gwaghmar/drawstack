import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEditProject,
  canManageProject,
  canReadProject,
  resolveProjectAccess,
} from "./project-access.ts";

describe("project access", () => {
  it("gives the owning workspace full access", () => {
    const access = resolveProjectAccess("workspace-1", "workspace-1", null);
    assert.equal(access, "owner");
    assert.equal(canReadProject(access), true);
    assert.equal(canEditProject(access), true);
    assert.equal(canManageProject(access), true);
  });

  it("limits collaborators to their assigned role", () => {
    const admin = resolveProjectAccess("workspace-1", "workspace-2", "admin");
    const editor = resolveProjectAccess("workspace-1", "workspace-2", "editor");
    const viewer = resolveProjectAccess("workspace-1", "workspace-2", "viewer");

    assert.equal(canEditProject(admin), true);
    assert.equal(canManageProject(admin), false);
    assert.equal(canEditProject(editor), true);
    assert.equal(canManageProject(editor), false);
    assert.equal(canReadProject(viewer), true);
    assert.equal(canEditProject(viewer), false);
  });

  it("denies users without workspace ownership or collaboration", () => {
    const access = resolveProjectAccess("workspace-1", "workspace-2", null);
    assert.equal(canReadProject(access), false);
    assert.equal(canEditProject(access), false);
    assert.equal(canManageProject(access), false);
  });
});

export type ProjectAccess = "owner" | "admin" | "editor" | "viewer" | null;

export function resolveProjectAccess(
  projectWorkspaceId: string,
  currentWorkspaceId: string,
  collaboratorRole?: string | null,
): ProjectAccess {
  if (projectWorkspaceId === currentWorkspaceId) return "owner";
  if (collaboratorRole === "admin" || collaboratorRole === "editor" || collaboratorRole === "viewer") {
    return collaboratorRole;
  }
  return null;
}

export function canReadProject(access: ProjectAccess): boolean {
  return access !== null;
}

export function canEditProject(access: ProjectAccess): boolean {
  return access === "owner" || access === "admin" || access === "editor";
}

export function canManageProject(access: ProjectAccess): boolean {
  return access === "owner";
}

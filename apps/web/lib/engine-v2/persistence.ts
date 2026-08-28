export type EngineV2SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "conflict"; updatedAt: string };

export type EngineV2RestoreResult =
  | { ok: true; source: string; updatedAt: string }
  | { ok: false; reason: "conflict"; updatedAt: string };

export function nextEngineV2UpdatedAt(current: Date, now = new Date()) {
  return new Date(Math.max(now.getTime(), current.getTime() + 1));
}

export function hasEngineV2VersionConflict(expectedUpdatedAt: string, currentUpdatedAt: Date) {
  const expected = new Date(expectedUpdatedAt);
  return Number.isNaN(expected.getTime()) || expected.getTime() !== currentUpdatedAt.getTime();
}

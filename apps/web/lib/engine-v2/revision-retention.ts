export function revisionIdsBeyondLimit(rows: Array<{ id: string }>, limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Revision limit must be a non-negative integer");
  return rows.slice(limit).map((row) => row.id);
}

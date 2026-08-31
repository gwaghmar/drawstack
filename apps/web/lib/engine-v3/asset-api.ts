import type { AssetStorage } from "./asset-storage.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function listAssets(storage: AssetStorage, ownerId: string) {
  if (!storage.status.available) return json({ error: storage.status.reason ?? "Asset storage unavailable", status: storage.status }, 503);
  return json({ status: storage.status, assets: await storage.list(ownerId) });
}
export async function getAsset(storage: AssetStorage, ownerId: string, sha256: string) {
  if (!storage.status.available) return json({ error: storage.status.reason ?? "Asset storage unavailable", status: storage.status }, 503);
  if (!/^[a-f0-9]{64}$/.test(sha256)) return json({ error: "Invalid asset hash" }, 400);
  const stored = await storage.get(ownerId, sha256);
  if (!stored) return json({ error: "Asset not found" }, 404);
  return new Response(stored.content.slice().buffer as ArrayBuffer, { headers: { "Content-Type": stored.asset.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
export async function uploadAsset(storage: AssetStorage, ownerId: string, request: Request) {
  if (!storage.status.available) return json({ error: storage.status.reason ?? "Asset storage unavailable", status: storage.status }, 503);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "A file field is required" }, 400);
  try {
    const result = await storage.put({ content: await file.arrayBuffer(), mime: file.type, source: String(form.get("source") ?? file.name), license: String(form.get("license") ?? "") || undefined }, ownerId);
    return json(result, result.created ? 201 : 200);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid asset" }, 400); }
}
export async function deleteAsset(storage: AssetStorage, ownerId: string, sha256: string) {
  if (!storage.status.available) return json({ error: storage.status.reason ?? "Asset storage unavailable", status: storage.status }, 503);
  if (!/^[a-f0-9]{64}$/.test(sha256)) return json({ error: "A valid sha256 query parameter is required" }, 400);
  const deleted = await storage.delete(ownerId, sha256);
  return deleted ? json({ deleted: true }) : json({ error: "Asset not found" }, 404);
}

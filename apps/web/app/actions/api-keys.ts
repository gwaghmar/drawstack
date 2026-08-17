"use server";

import { auth } from "@/auth";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { sha256Hex, token } from "@/lib/crypto";

export async function listApiKeys() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return [];
  const { user } = await ensureUserAndWorkspace(email);
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(name: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { user } = await ensureUserAndWorkspace(email);

  const raw = token("fc_", 24);
  const prefix = raw.slice(0, 6);
  const keyHash = sha256Hex(raw);
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: user.id,
    name: name || "API key",
    prefix,
    keyHash,
    createdAt: new Date(),
  });
  return raw;
}

export async function deleteApiKey(id: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { user } = await ensureUserAndWorkspace(email);
  // Only delete keys that belong to this user — ownership enforced by AND clause
  await db.delete(apiKeys).where(
    and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id))
  );
}


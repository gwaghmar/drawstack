"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { isAdminEmail } from "@/lib/admin";

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");
  const { user } = await ensureUserAndWorkspace(email);
  if (user.role !== "admin" && !isAdminEmail(email)) {
    redirect("/app");
  }
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  creditsBalance: number;
};

export async function adminListUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      role: users.role,
      creditsBalance: users.creditsBalance,
    })
    .from(users)
    .orderBy(desc(users.email))
    .limit(500);
}

export async function adminSetCredits(userId: string, credits: number) {
  await requireAdmin();
  if (!Number.isFinite(credits) || credits < 0 || credits > 1_000_000) {
    throw new Error("Invalid credits");
  }
  await db
    .update(users)
    .set({ creditsBalance: Math.floor(credits) })
    .where(eq(users.id, userId));
  revalidatePath("/app/admin");
}

export async function adminSetPlan(userId: string, plan: "free" | "pro") {
  await requireAdmin();
  await db.update(users).set({ plan }).where(eq(users.id, userId));
  revalidatePath("/app/admin");
}

/** Dev-only helper — Stripe webhook sets plan in production. */
export async function setPlan(email: string, plan: "free" | "pro") {
  if (process.env.NODE_ENV !== "development") return;
  await db.update(users).set({ plan }).where(eq(users.email, email));
}

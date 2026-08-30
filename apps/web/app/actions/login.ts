"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeLocalRedirect } from "@/lib/safe-redirect";

const defaultAfterLogin = "/app/editor";

function getOrigin(requestHeaders: Awaited<ReturnType<typeof headers>>) {
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const host = requestHeaders.get("host");
  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3040";
}

async function buildCallbackUrl(next: string) {
  const h = await headers();
  const origin = getOrigin(h);
  const callbackUrl = new URL("/api/auth/callback", origin);
  callbackUrl.searchParams.set("next", next);
  return callbackUrl.toString();
}

export async function signInGoogle(callbackUrl?: string) {
  const supabase = await createClient();
  const redirectTo = await buildCallbackUrl(callbackUrl ?? defaultAfterLogin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error || !data.url) throw new Error(error?.message ?? "OAuth failed");
  redirect(data.url);
}

export async function signInGitHub(callbackUrl?: string) {
  const supabase = await createClient();
  const redirectTo = await buildCallbackUrl(callbackUrl ?? defaultAfterLogin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });
  if (error || !data.url) throw new Error(error?.message ?? "OAuth failed");
  redirect(data.url);
}

export async function signInApple(callbackUrl?: string) {
  const supabase = await createClient();
  const redirectTo = await buildCallbackUrl(callbackUrl ?? defaultAfterLogin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo },
  });
  if (error || !data.url) throw new Error(error?.message ?? "OAuth failed");
  redirect(data.url);
}

export async function signInWithEmail(email: string, callbackUrl?: string) {
  const supabase = await createClient();
  const redirectTo = await buildCallbackUrl(callbackUrl ?? defaultAfterLogin);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw new Error(error.message);
}

/** Sign in with email + password. Returns error string or null. */
export async function signInWithPassword(
  email: string,
  password: string,
  callbackUrl?: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
      return "invalid_credentials";
    }
    return "sign_in_failed";
  }
  redirect(safeLocalRedirect(callbackUrl, defaultAfterLogin));
}

/** Sign up with email + password. Returns error string or null. */
export async function signUpWithPassword(
  email: string,
  password: string,
  callbackUrl?: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error("[signUpWithPassword] Supabase error:", error.status, error.message);
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return "already_registered";
    }
    return "sign_up_failed";
  }
  // Supabase auto-confirms (mailer_autoconfirm=true) — redirect straight in
  redirect(safeLocalRedirect(callbackUrl, defaultAfterLogin));
}

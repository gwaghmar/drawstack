import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import type { ApiError } from "@flowchart/core";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function resolvePriceId(interval: "month" | "year"): string | null {
  const monthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const annual = process.env.STRIPE_PRICE_PRO_ANNUAL;
  const legacy = process.env.STRIPE_PRICE_PRO;
  const chosen = interval === "year" ? annual ?? legacy : monthly ?? legacy;
  if (!chosen) return null;
  const allow = new Set(
    [monthly, annual, legacy].filter(Boolean) as string[],
  );
  return allow.has(chosen) ? chosen : null;
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    const body: ApiError = { error: "Unauthorized", code: "UNAUTHORIZED" };
    return NextResponse.json(body, { status: 401 });
  }

  try {
    await ensureUserAndWorkspace(email);
  } catch (err) {
    const body: ApiError = { error: "Failed to initialize user", code: "INTERNAL_ERROR" };
    return NextResponse.json(body, { status: 500 });
  }

  if (!stripe) {
    const body: ApiError = {
      error: "Stripe not configured",
      code: "INTERNAL_ERROR",
    };
    return NextResponse.json(body, { status: 501 });
  }

  let interval: "month" | "year" = "month";
  try {
    const j = (await req.json()) as { interval?: string };
    if (j.interval === "year") interval = "year";
  } catch {
    /* body optional */
  }

  const priceId = resolvePriceId(interval);
  if (!priceId) {
    const body: ApiError = {
      error:
        "Stripe price not configured: set STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL or STRIPE_PRICE_PRO",
      code: "INTERNAL_ERROR",
    };
    return NextResponse.json(body, { status: 501 });
  }

  const origin = new URL(req.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app/billing?billing=success`,
    cancel_url: `${origin}/app/billing?billing=cancel`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkout.url });
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(req: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const email = s.customer_email ?? s.customer_details?.email;
    const customerId = s.customer as string | undefined;
    if (email && customerId) {
      const updated = await db
        .update(users)
        .set({ plan: "pro", stripeCustomerId: customerId })
        .where(eq(users.email, email))
        .returning({ id: users.id });
      if (!updated.length) {
        console.warn(`[stripe] checkout.session.completed: user not found for email ${email}, skipping update`);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const cid = sub.customer as string;
    await db
      .update(users)
      .set({ plan: "free" })
      .where(eq(users.stripeCustomerId, cid));
  }

  // Sync plan changes (e.g. trial end, grace period expiry, re-activation)
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const cid = sub.customer as string;
    const isActive = sub.status === "active" || sub.status === "trialing";
    await db
      .update(users)
      .set({ plan: isActive ? "pro" : "free" })
      .where(eq(users.stripeCustomerId, cid));
  }

  // Downgrade to free when a payment fails so Pro features are gated
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const cid =
      typeof invoice.customer === "string"
        ? invoice.customer
        : (invoice.customer as Stripe.Customer | null)?.id;
    if (cid) {
      await db
        .update(users)
        .set({ plan: "free" })
        .where(eq(users.stripeCustomerId, cid));
    }
  }

  return NextResponse.json({ received: true });
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BillingClient } from "./billing-client";
import { ManageSubscriptionClient } from "./manage-subscription-client";
import { getPlanForEmail } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { BadgeCheck, CheckCircle2 } from "lucide-react";
import { isStripeBillingEnabled } from "@/lib/billing-config";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/app/billing"));
  }
  const email = session.user.email;
  const plan = await getPlanForEmail(email);
  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId })
    .from(users).where(eq(users.email, email)).limit(1);
  const hasStripeCustomer = Boolean(user?.stripeCustomerId);
  const billingEnabled = isStripeBillingEnabled();

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>

      {sp.billing === "success" && plan === "pro" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <BadgeCheck className="h-4 w-4" />
          <span>Welcome to Pro. Your plan has been updated.</span>
        </div>
      )}
      {sp.billing === "cancel" && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Checkout cancelled — your plan was not changed.
        </div>
      )}

      {/* Current plan status */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 capitalize">{plan}</p>
          </div>
          {plan === "pro" ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">Active</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Free tier</span>
          )}
        </div>
        {plan === "free" && (
          <p className="mt-3 text-sm text-slate-600">
            Upgrade to Pro for unlimited hosted AI generations and watermark-free diagrams.
          </p>
        )}
        {billingEnabled && plan === "pro" && hasStripeCustomer && (
          <div className="mt-4">
            <ManageSubscriptionClient />
          </div>
        )}
      </div>

      {plan === "free" && (
        billingEnabled ? (
          <div className="mt-6 space-y-4">
            <h2 className="text-base font-medium text-slate-900">Upgrade to Pro</h2>
            <BillingClient />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-medium text-slate-900">Paid plans are coming soon</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Checkout is disabled while we test the full product experience.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Not available
              </span>
            </div>
          </div>
        )
      )}

      {plan === "pro" && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-medium text-slate-900">Pro features included</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {[
              "Unlimited AI generations",
              "No watermarks",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

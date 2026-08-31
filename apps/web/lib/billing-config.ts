export function isStripeBillingEnabled(): boolean {
  return process.env.STRIPE_ENABLED === "true";
}

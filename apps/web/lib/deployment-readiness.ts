type Env = Partial<Record<string, string | undefined>>;

export type DeploymentReadinessStatus = "ready" | "missing" | "blocked";

export type DeploymentReadinessItem = {
  id: string;
  label: string;
  status: DeploymentReadinessStatus;
  detail: string;
};

export type DeploymentReadinessReport = {
  ready: boolean;
  items: DeploymentReadinessItem[];
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function flagEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function required(
  id: string,
  label: string,
  value: string | undefined,
  detail: string,
): DeploymentReadinessItem {
  return hasValue(value)
    ? { id, label, status: "ready", detail: "Configured" }
    : { id, label, status: "missing", detail };
}

function blockedMockFlag(
  id: string,
  label: string,
  value: string | undefined,
): DeploymentReadinessItem {
  return flagEnabled(value)
    ? {
        id,
        label,
        status: "blocked",
        detail: "Disable this before production deploys.",
      }
    : { id, label, status: "ready", detail: "Disabled" };
}

function hostedAiReady(env: Env): DeploymentReadinessItem {
  const configured = [
    env.OPENROUTER_API_KEY,
    env.GOOGLE_GENERATIVE_AI_API_KEY,
    env.OPENAI_API_KEY,
    env.AI_GATEWAY_KEY,
  ].some(hasValue);
  return configured
    ? { id: "hosted-ai", label: "Hosted AI provider", status: "ready", detail: "Configured" }
    : { id: "hosted-ai", label: "Hosted AI provider", status: "missing", detail: "Required for generation." };
}

function stripeReadiness(env: Env): DeploymentReadinessItem[] {
  if (!flagEnabled(env.STRIPE_ENABLED)) {
    return [{ id: "stripe-billing", label: "Stripe billing", status: "ready", detail: "Disabled" }];
  }
  return [
    required("stripe-secret", "Stripe secret", env.STRIPE_SECRET_KEY, "Required when Stripe billing is enabled."),
    required("stripe-webhook", "Stripe webhook secret", env.STRIPE_WEBHOOK_SECRET, "Required when Stripe billing is enabled."),
    hasValue(env.STRIPE_PRICE_PRO) || (hasValue(env.STRIPE_PRICE_PRO_MONTHLY) && hasValue(env.STRIPE_PRICE_PRO_ANNUAL))
      ? { id: "stripe-prices", label: "Stripe prices", status: "ready", detail: "Configured" }
      : { id: "stripe-prices", label: "Stripe prices", status: "missing", detail: "Configure a legacy Pro price or both monthly and annual prices." },
  ];
}

export function getDeploymentReadiness(
  env: Env = process.env,
): DeploymentReadinessReport {
  const items: DeploymentReadinessItem[] = [
    required("database-url", "Postgres DATABASE_URL", env.DATABASE_URL, "Required for projects, users, revisions, and REST API keys."),
    required("supabase-url", "Supabase URL", env.NEXT_PUBLIC_SUPABASE_URL, "Required for Supabase auth."),
    required("supabase-anon-key", "Supabase anon key", env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Required for Supabase browser/server clients."),
    required("auth-secret", "Auth secret", env.AUTH_SECRET, "Required for production auth/session safety."),
    hostedAiReady(env),
    blockedMockFlag("mock-auth", "MOCK_AUTH", env.MOCK_AUTH),
    blockedMockFlag("mock-db", "MOCK_DB", env.MOCK_DB),
    ...stripeReadiness(env),
  ];

  return {
    ready: items.every((item) => item.status === "ready"),
    items,
  };
}

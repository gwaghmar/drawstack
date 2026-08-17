import brandData from "./brand-icon-data.json" with { type: "json" };

export type BrandIcon = { slug: string; title: string; hex: string; path: string };

const DATA = brandData as Record<string, { title: string; hex: string; path: string }>;

// token (lowercased) -> brand-icon-data.json slug. Real vendor marks (CC0, via
// simple-icons) for third-party platforms named directly in architecture/data
// diagrams. AWS/Azure/Salesforce/ServiceNow/Slack/Tableau/dbt/Twilio/OpenAI are
// not redistributed by simple-icons (trademark-restricted) — those keep the
// generic provider-tinted glyph in cloud-glyphs.tsx instead of a real logo.
const BRAND_ALIASES: Record<string, string> = {
  databricks: "databricks",
  snowflake: "snowflake",
  gcp: "googlecloud", "google-cloud": "googlecloud", "google cloud": "googlecloud",
  mongodb: "mongodb", mongo: "mongodb",
  postgres: "postgresql", postgresql: "postgresql",
  mysql: "mysql",
  redis: "redis",
  elasticsearch: "elasticsearch", elastic: "elasticsearch",
  kafka: "apachekafka", "apache-kafka": "apachekafka",
  spark: "apachespark", "apache-spark": "apachespark",
  airflow: "apacheairflow", "apache-airflow": "apacheairflow",
  hadoop: "apachehadoop", "apache-hadoop": "apachehadoop",
  looker: "looker",
  docker: "docker",
  kubernetes: "kubernetes", k8s: "kubernetes",
  terraform: "terraform",
  jenkins: "jenkins",
  gitlab: "gitlab",
  github: "github",
  bitbucket: "bitbucket",
  grafana: "grafana",
  prometheus: "prometheus",
  datadog: "datadog",
  newrelic: "newrelic", "new-relic": "newrelic",
  sentry: "sentry",
  nginx: "nginx",
  cloudflare: "cloudflare",
  vercel: "vercel",
  netlify: "netlify",
  supabase: "supabase",
  firebase: "firebase",
  stripe: "stripe",
  okta: "okta",
  auth0: "auth0",
  hubspot: "hubspot",
  zendesk: "zendesk",
  jira: "jira",
  confluence: "confluence",
  notion: "notion",
  figma: "figma",
  rabbitmq: "rabbitmq",
  cassandra: "apachecassandra", "apache-cassandra": "apachecassandra",
  clickhouse: "clickhouse",
  dynatrace: "dynatrace",
  splunk: "splunk",
  anthropic: "anthropic", claude: "anthropic",
  npm: "npm",
  python: "python",
  node: "nodedotjs", nodejs: "nodedotjs", "node.js": "nodedotjs",
  react: "react",
  vue: "vuedotjs", vuejs: "vuedotjs",
  typescript: "typescript",
  graphql: "graphql",
  shopify: "shopify",
  zoom: "zoom",
  "google-analytics": "googleanalytics", ga: "googleanalytics",
};

/** Resolve a service token to a real vendor brand mark, if one is licensed for use. */
export function resolveBrandIcon(service: string | undefined): BrandIcon | null {
  if (!service) return null;
  const slug = BRAND_ALIASES[service.toLowerCase().trim()];
  if (!slug) return null;
  const meta = DATA[slug];
  if (!meta) return null;
  return { slug, ...meta };
}

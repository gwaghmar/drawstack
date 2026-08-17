export type CloudProvider = "aws" | "gcp" | "azure" | "generic";

export const PROVIDER_COLORS: Record<CloudProvider, string> = {
  aws: "#FF9900",
  gcp: "#4285F4",
  azure: "#0078D4",
  generic: "#6366f1",
};

export const GLYPH_IDS = [
  "compute", "function", "container", "storage", "database", "cache", "cdn",
  "load-balancer", "api-gateway", "queue", "dns", "firewall", "auth",
  "monitoring", "user", "browser", "mobile", "internet", "box",
] as const;
export type GlyphId = (typeof GLYPH_IDS)[number];

// token (lowercased) -> base glyph id. Extension point for an official icon pack:
// merge additional aliases here, or check an override map first in resolveIconId.
const ALIASES: Record<string, GlyphId> = {
  ec2: "compute", vm: "compute", compute: "compute", server: "compute", instance: "compute",
  "compute-engine": "compute", droplet: "compute",
  lambda: "function", function: "function", faas: "function", "cloud-functions": "function",
  "azure-functions": "function", "cloud-run": "function", worker: "function",
  container: "container", docker: "container", ecs: "container", fargate: "container",
  kubernetes: "container", k8s: "container", gke: "container", aks: "container", eks: "container",
  s3: "storage", gcs: "storage", blob: "storage", storage: "storage", "object-storage": "storage",
  "block-storage": "storage", "file-storage": "storage", ebs: "storage", bucket: "storage",
  rds: "database", database: "database", db: "database", "sql-db": "database", "nosql-db": "database",
  dynamodb: "database", firestore: "database", cosmos: "database", postgres: "database",
  mysql: "database", mongodb: "database", "data-warehouse": "database", bigquery: "database",
  redshift: "database", snowflake: "database", search: "database", elasticsearch: "database",
  cache: "cache", redis: "cache", elasticache: "cache", memcached: "cache",
  cdn: "cdn", cloudfront: "cdn", cloudflare: "cdn", edge: "cdn",
  "load-balancer": "load-balancer", lb: "load-balancer", alb: "load-balancer", elb: "load-balancer",
  nlb: "load-balancer",
  "api-gateway": "api-gateway", apigw: "api-gateway", api: "api-gateway", gateway: "api-gateway",
  queue: "queue", sqs: "queue", sns: "queue", pubsub: "queue", "event-bus": "queue",
  eventbridge: "queue", kafka: "queue", stream: "queue", kinesis: "queue",
  dns: "dns", route53: "dns",
  firewall: "firewall", waf: "firewall", "security-group": "firewall",
  auth: "auth", cognito: "auth", iam: "auth", identity: "auth", oauth: "auth",
  monitoring: "monitoring", cloudwatch: "monitoring", logging: "monitoring", grafana: "monitoring",
  metrics: "monitoring",
  user: "user", users: "user", client: "user",
  browser: "browser", web: "browser", frontend: "browser",
  mobile: "mobile", app: "mobile", ios: "mobile", android: "mobile",
  internet: "internet", external: "internet", public: "internet",
};

export function resolveIconId(service: string | undefined): GlyphId {
  if (!service) return "box";
  return ALIASES[service.toLowerCase()] ?? "box";
}

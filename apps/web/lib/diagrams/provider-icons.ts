import manifest from "@/public/icons/cloud/manifest.json";
import type { CloudProvider } from "./cloud-icons";

const MANIFEST = manifest as Record<string, Record<string, string>>;

// token (lowercased) -> manifest key, per provider. Keeps the wide vocabulary
// already accepted by cloud-icons.ts working (ec2, lambda, s3, rds, etc.)
// while resolving to the official per-service icon when the provider is known.
const TOKEN_ALIASES: Record<string, string> = {
  ec2: "ec2", instance: "ec2", vm: "ec2", compute: "ec2",
  lambda: "lambda", function: "lambda", "cloud-functions": "cloud-functions", "azure-functions": "azure-functions",
  ecs: "ecs", eks: "eks", gke: "gke", aks: "aks", kubernetes: "eks", k8s: "eks",
  container: "ecs", fargate: "fargate", "container-instances": "container-instances",
  "cloud-run": "cloud-run", run: "cloud-run",
  rds: "rds", "sql-db": "rds", database: "rds", db: "rds", "cloud-sql": "cloud-sql", "sql-database": "sql-database",
  dynamodb: "dynamodb", "nosql-db": "dynamodb", firestore: "firestore", cosmos: "cosmos", cosmosdb: "cosmos",
  aurora: "aurora", redshift: "redshift", "data-warehouse": "redshift", bigquery: "bigquery",
  bigtable: "bigtable", spanner: "spanner",
  postgres: "postgresql", postgresql: "postgresql", mysql: "mysql",
  elasticache: "elasticache", cache: "elasticache", redis: "redis", memorystore: "memorystore",
  s3: "s3", storage: "s3", bucket: "s3", "object-storage": "s3", gcs: "gcs", blob: "blob",
  ebs: "ebs", "block-storage": "ebs", "persistent-disk": "persistent-disk",
  efs: "efs", "file-storage": "efs",
  cloudfront: "cloudfront", cdn: "cloudfront", "cloud-cdn": "cloud-cdn", "azure-cdn": "azure-cdn", edge: "cloudfront",
  elb: "elb", "load-balancer": "elb", lb: "elb", alb: "alb", nlb: "nlb",
  "cloud-load-balancing": "cloud-load-balancing", "azure-lb": "azure-lb",
  apigateway: "apigateway", "api-gateway": "apigateway", api: "apigateway", gateway: "apigateway",
  apigee: "apigee", "gcp-api-gateway": "gcp-api-gateway", apim: "apim",
  route53: "route53", dns: "route53", "cloud-dns": "cloud-dns", "azure-dns": "azure-dns",
  networkfirewall: "networkfirewall", firewall: "networkfirewall", waf: "networkfirewall",
  "security-group": "networkfirewall", "cloud-armor": "cloud-armor", "azure-firewall": "azure-firewall",
  sqs: "sqs", queue: "sqs", sns: "sns", "pub-sub": "pubsub", pubsub: "pubsub",
  eventbridge: "eventbridge", "event-bus": "eventbridge", "service-bus": "service-bus",
  iam: "iam", auth: "iam", cognito: "iam", identity: "iam", "azure-ad": "azure-ad", oauth: "iam",
  cloudwatch: "cloudwatch", monitoring: "cloudwatch", logging: "cloudwatch", "azure-sentinel": "azure-sentinel",
};

/** Resolve a service token to an official per-service AWS/GCP/Azure icon path, if available. */
export function resolveProviderIconPath(provider: CloudProvider | undefined, service: string | undefined): string | null {
  if (!provider || provider === "generic" || !service) return null;
  const entries = MANIFEST[provider];
  if (!entries) return null;
  const key = TOKEN_ALIASES[service.toLowerCase().trim()];
  if (!key) return null;
  return entries[key] ?? null;
}

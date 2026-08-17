import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareViewer } from "@/components/share-viewer";
import { db } from "@/lib/db";
import { shareLinks, projects, workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sha256Hex } from "@/lib/crypto";

const TYPE_LABELS: Record<string, string> = {
  mermaid: "Text flowchart", excalidraw: "Whiteboard", reactflow: "Node graph",
  echarts: "Chart", nivo: "Chart", freeform: "Free Canvas", bpmn: "BPMN process",
  cloud: "Cloud architecture", erd: "Database schema", orgchart: "Org chart",
  timeline: "Timeline", versus: "Versus", matrix2x2: "2x2 Matrix", funnel: "Funnel",
  venn: "Venn Diagram", tierlist: "Tier List", iceberg: "Iceberg", alignment: "Alignment Chart",
  budget: "Budget Breakdown", habits: "Habit Tracker", bingo: "Bingo Card", bracket: "Bracket",
};

async function resolveShare(token: string) {
  try {
    const tokenHash = sha256Hex(token);
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash)).limit(1);
    if (!link) return { kind: "missing" as const };
    if (link.expiresAt && link.expiresAt < new Date()) return { kind: "expired" as const };
    const [p] = await db
      .select({ title: projects.title, diagramType: projects.diagramType, workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, link.projectId))
      .limit(1);
    if (!p) return { kind: "missing" as const };
    // Resolve author handle for attribution
    const [ws] = await db.select({ ownerId: workspaces.ownerId }).from(workspaces).where(eq(workspaces.id, p.workspaceId)).limit(1);
    const authorHandle = ws
      ? await db.select({ handle: users.handle }).from(users).where(eq(users.id, ws.ownerId)).limit(1).then(r => r[0]?.handle ?? null)
      : null;
    return { kind: "ok" as const, title: p.title, diagramType: p.diagramType, authorHandle };
  } catch {
    return { kind: "missing" as const };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await resolveShare(token);
  if (result.kind !== "ok") {
    return { title: "Shared Diagram — drawxyz" };
  }

  const typeLabel = TYPE_LABELS[result.diagramType] ?? "Diagram";
  const title = result.title ? `${result.title} — drawxyz` : "Shared Diagram — drawxyz";
  const description = `View this ${typeLabel} created with drawxyz.`;
  const ogImageUrl = `/s/${encodeURIComponent(token)}/og`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "drawxyz",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolveShare(token);
  if (result.kind === "missing") notFound();
  return <ShareViewer token={token} authorHandle={result.kind === "ok" ? result.authorHandle : null} />;
}

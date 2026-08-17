import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shareLinks, projects } from "@/lib/db/schema";
import { sha256Hex } from "@/lib/crypto";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
  mermaid: "Text flowchart",
  excalidraw: "Whiteboard",
  reactflow: "Node graph",
  echarts: "Chart",
  nivo: "Chart",
  freeform: "Free Canvas",
  bpmn: "BPMN process",
  cloud: "Cloud architecture",
  erd: "Database schema",
  orgchart: "Org chart",
  timeline: "Timeline",
  versus: "Versus",
  matrix2x2: "2x2 Matrix",
  funnel: "Funnel",
  venn: "Venn Diagram",
  tierlist: "Tier List",
  iceberg: "Iceberg",
  alignment: "Alignment Chart",
  budget: "Budget Breakdown",
  habits: "Habit Tracker",
  bingo: "Bingo Card",
  bracket: "Bracket",
};

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  // Format: data:<mime>;base64,<payload>
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let title = "Shared Diagram";
  let typeLabel = "Diagram";
  let storedPreview: string | null = null;

  try {
    const tokenHash = sha256Hex(token);
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash)).limit(1);
    if (link && (!link.expiresAt || link.expiresAt > new Date())) {
      storedPreview = link.previewDataUrl ?? null;
      const [p] = await db
        .select({ title: projects.title, diagramType: projects.diagramType })
        .from(projects)
        .where(eq(projects.id, link.projectId))
        .limit(1);
      if (p) {
        title = p.title || "Shared Diagram";
        typeLabel = TYPE_LABELS[p.diagramType] ?? "Diagram";
      }
    }
  } catch {
    // fall through to defaults
  }

  // If we captured a real diagram preview at share-create time, serve it
  // directly. This is the actual rendered diagram, not a generic card.
  if (storedPreview) {
    const decoded = decodeDataUrl(storedPreview);
    if (decoded) {
      const body = new Uint8Array(decoded.bytes);
      return new NextResponse(body, {
        headers: {
          "Content-Type": decoded.mime,
          "Cache-Control": "public, max-age=300, s-maxage=600",
        },
      });
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 50%, #fdf4ff 100%)",
          padding: "64px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: "20px",
            }}
          >
            F
          </div>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#1e293b" }}>drawxyz</div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#6366f1",
              textTransform: "uppercase",
              letterSpacing: "2px",
              marginBottom: "16px",
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: "20px", color: "#64748b" }}>
            View this diagram on drawxyz
          </div>
          <div style={{ fontSize: "18px", color: "#94a3b8" }}>flowstudio.app</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    },
  );
}

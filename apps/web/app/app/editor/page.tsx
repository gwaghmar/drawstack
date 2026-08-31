import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { EditorClient } from "@/components/editor-client";
import { EditorWithCollaboration } from "@/components/editor-with-collaboration";
import { getProject } from "@/app/actions/project";
import { getPlanForEmail } from "@/lib/entitlements";
import { ensureUserAndWorkspace } from "@/lib/user-sync";
import { TEMPLATES, ALL_TEMPLATES, DIAGRAM_TYPE_DEFAULTS, getDiagramTypeMeta, getTemplateSource } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const VALID_TYPES: DiagramType[] = ["freeform"];

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; template?: string; type?: string; prompt?: string; welcome?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    const qs = new URLSearchParams();
    if (sp.id) qs.set("id", sp.id);
    if (sp.template) qs.set("template", sp.template);
    if (sp.type) qs.set("type", sp.type);
    const q = qs.toString();
    const dest = q ? `/app/editor?${q}` : "/app/editor";
    redirect(`/login?callbackUrl=${encodeURIComponent(dest)}`);
  }

  await ensureUserAndWorkspace(email);
  const projectId = sp.id ?? null;
  const templateId = sp.template ?? null;
  const typeParam = sp.type as DiagramType | undefined;
  const initialPrompt = sp.prompt ?? null;
  const initialWelcome = sp.welcome === "1";

  const plan = await getPlanForEmail(email);
  const showWatermark = plan !== "pro";
  const userName = session?.user?.name ?? email.split("@")[0];

  // Generate unique session ID for this editor session (for collaboration)
  const sessionId = randomUUID();

  const [userData] = await db
    .select({ creditsBalance: users.creditsBalance })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const creditsBalance = userData?.creditsBalance ?? 0;

  if (projectId) {
    const p = await getProject(projectId);
    if (!p) redirect("/app");
    const diagramType: DiagramType = VALID_TYPES.includes(p.diagramType as DiagramType)
      ? (p.diagramType as DiagramType)
      : "freeform";
    return (
      <EditorWithCollaboration
        projectId={p.id}
        sessionId={sessionId}
        initialTitle={p.title}
        initialSource={p.source}
        initialThemeId={p.themeId}
        initialDiagramType={diagramType}
        showWatermark={showWatermark}
        creditsBalance={creditsBalance}
        initialPrompt={initialPrompt}
        initialWelcome={initialWelcome}
        userEmail={email}
        userName={userName}
      />
    );
  }

  if (typeParam && VALID_TYPES.includes(typeParam)) {
    const meta = getDiagramTypeMeta(typeParam);
    return (
      <EditorClient
        projectId={null}
        initialTitle={`New ${meta.label}`}
        initialSource={DIAGRAM_TYPE_DEFAULTS[typeParam]}
        initialThemeId="stage_pipeline"
        initialDiagramType={typeParam}
        showWatermark={showWatermark}
        creditsBalance={creditsBalance}
        initialPrompt={initialPrompt}
        initialWelcome={initialWelcome}
        userEmail={email}
        userName={userName}
      />
    );
  }

  // No project, type, or explicit template — start on a blank whiteboard to
  // eliminate blank-page paralysis and let people start sketching immediately.
  if (!templateId) {
    return (
      <EditorClient
        projectId={null}
        initialTitle="Example: Whiteboard Sketch"
        initialSource={DIAGRAM_TYPE_DEFAULTS.freeform}
        initialThemeId="stage_pipeline"
        initialDiagramType="freeform"
        showWatermark={showWatermark}
        creditsBalance={creditsBalance}
        isExample={true}
        initialPrompt={initialPrompt}
        initialWelcome={initialWelcome}
        userEmail={email}
        userName={userName}
      />
    );
  }

  const t = ALL_TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  const templateDiagramType: DiagramType = VALID_TYPES.includes((t.diagramType ?? "freeform") as DiagramType)
    ? ((t.diagramType ?? "freeform") as DiagramType)
    : "freeform";
  return (
    <EditorClient
      projectId={null}
      initialTitle={t.title}
      initialSource={getTemplateSource(t)}
      initialThemeId="stage_pipeline"
      initialDiagramType={templateDiagramType}
      showWatermark={showWatermark}
      creditsBalance={creditsBalance}
      initialPrompt={initialPrompt}
      initialWelcome={initialWelcome}
      userEmail={email}
      userName={userName}
    />
  );
}

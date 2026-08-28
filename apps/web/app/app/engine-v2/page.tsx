import { EngineCanvas } from "@/components/engine-v2/engine-canvas";
import { getEditableEngineV2Project } from "@/app/actions/engine-v2";
import { auth } from "@/auth";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";
import { normalizeEngineV2Prompt } from "@/lib/engine-v2/prompt";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EngineV2Page({ searchParams }: { searchParams: Promise<{ id?: string; prompt?: string; auto?: string }> }) {
  const { id, prompt, auto } = await searchParams;
  const callbackSearch = new URLSearchParams();
  if (id) callbackSearch.set("id", id);
  if (prompt) callbackSearch.set("prompt", prompt);
  if (auto === "1") callbackSearch.set("auto", "1");
  const callbackUrl = `/app/engine-v2${callbackSearch.size ? `?${callbackSearch}` : ""}`;
  const session = await auth();
  if (!session?.user?.email) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const initialPrompt = normalizeEngineV2Prompt(prompt);
  const autoGenerate = auto === "1" && Boolean(initialPrompt);
  if (!id) return <EngineCanvas initialPrompt={initialPrompt} autoGenerate={autoGenerate} />;
  const project = await getEditableEngineV2Project(id);
  if (!project || project.diagramType !== "engine-v2") notFound();
  let parsed: unknown;
  try {
    parsed = JSON.parse(project.source);
  } catch {
    notFound();
  }
  const validated = validateEngineV2Document(parsed);
  if (!validated.ok) notFound();
  return <EngineCanvas initialDocument={validated.document} initialProjectId={project.id} initialUpdatedAt={project.updatedAt.toISOString()} initialPrompt={initialPrompt} autoGenerate={autoGenerate} />;
}

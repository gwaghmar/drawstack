import { EngineCanvas } from "@/components/engine-v2/engine-canvas";
import { EngineV3Canvas } from "@/components/engine-v3/engine-v3-canvas";
import { getEditableEngineV2Project } from "@/app/actions/engine-v2";
import { auth } from "@/auth";
import { ENGINE_V2_SAMPLE } from "@/lib/engine-v2/document";
import { parseEngineSource } from "@/lib/engine-document-source";
import { migrateV2ToV3 } from "@/lib/engine-v3/migration";
import { normalizeEngineV2Prompt } from "@/lib/engine-v2/prompt";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EngineV2Page({ searchParams }: { searchParams: Promise<{ id?: string; prompt?: string; auto?: string; mode?: string }> }) {
  const { id, prompt, auto, mode } = await searchParams;
  const callbackSearch = new URLSearchParams();
  if (id) callbackSearch.set("id", id);
  if (prompt) callbackSearch.set("prompt", prompt);
  if (auto === "1") callbackSearch.set("auto", "1");
  if (mode === "v3") callbackSearch.set("mode", "v3");
  const callbackUrl = `/app/engine-v2${callbackSearch.size ? `?${callbackSearch}` : ""}`;
  const session = await auth();
  if (!session?.user?.email) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const initialPrompt = normalizeEngineV2Prompt(prompt);
  const autoGenerate = auto === "1" && Boolean(initialPrompt);
  if (!id) {
    if (mode === "v3") return <EngineV3Canvas initialDocument={migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document} />;
    return <EngineCanvas initialPrompt={initialPrompt} autoGenerate={autoGenerate} />;
  }
  const project = await getEditableEngineV2Project(id);
  if (!project || project.diagramType !== "engine-v2") notFound();
  try {
    const parsed = parseEngineSource(project.source);
    if (parsed.version === 3) return <EngineV3Canvas initialDocument={parsed.document} initialProjectId={project.id} initialUpdatedAt={project.updatedAt.toISOString()} />;
    if (mode === "v3") return <EngineV3Canvas initialDocument={migrateV2ToV3(parsed.document).document} initialProjectId={project.id} initialUpdatedAt={project.updatedAt.toISOString()} />;
    return <EngineCanvas initialDocument={parsed.document} initialProjectId={project.id} initialUpdatedAt={project.updatedAt.toISOString()} initialPrompt={initialPrompt} autoGenerate={autoGenerate} />;
  } catch {
    notFound();
  }
}

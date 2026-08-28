import { EngineCanvas } from "@/components/engine-v2/engine-canvas";
import { getProject } from "@/app/actions/project";
import { validateEngineV2Document } from "@/lib/engine-v2/compiler";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EngineV2Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) return <EngineCanvas />;
  const project = await getProject(id);
  if (!project || project.diagramType !== "engine-v2") notFound();
  let parsed: unknown;
  try {
    parsed = JSON.parse(project.source);
  } catch {
    notFound();
  }
  const validated = validateEngineV2Document(parsed);
  if (!validated.ok) notFound();
  return <EngineCanvas initialDocument={validated.document} initialProjectId={project.id} />;
}

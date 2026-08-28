import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { deleteProject, listProjects } from "@/app/actions/project";
import { getDiagramTypeMeta } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";
import { DiagramTypeIcon } from "@/components/diagram-icon";
import {
  ArrowRight,
  Clock3,
  FileText,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STARTER_WORKFLOWS = [
  {
    title: "Performance dashboard",
    description: "Metrics, comparisons, trends, and a clear operating narrative.",
    prompt: "Create an executive performance dashboard with revenue, retention, conversion, and a six-month trend",
  },
  {
    title: "Customer journey",
    description: "A structured flow with stages, decisions, and measurable outcomes.",
    prompt: "Create a customer journey from acquisition through activation and retention with conversion metrics",
  },
  {
    title: "Project timeline",
    description: "A schedule with phases, owners, milestones, and delivery windows.",
    prompt: "Create a product launch timeline with research, design, build, beta, and release phases",
  },
  {
    title: "System architecture",
    description: "Services, dependencies, data stores, and directional connections.",
    prompt: "Create a system architecture for a SaaS application with web, API, auth, jobs, cache, and database services",
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name?.split(" ")[0] || "there";
  const projects = await listProjects();
  async function handleDelete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await deleteProject(id);
    redirect("/app");
  }

  return (
    <main className="min-h-0 w-full flex-1 overflow-y-auto bg-[#f7f7f5]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              AI-first workspace
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              What should drawxyz create, {userName}?
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Generate diagrams, data charts, process maps, and export-ready visuals from one prompt.
            </p>

            <form action="/app/engine-v2" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <input type="hidden" name="auto" value="1" />
              <textarea
                name="prompt"
                className="min-h-[116px] w-full resize-none bg-transparent px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                placeholder="Example: Create a multilingual sales funnel chart for a LinkedIn post"
              />
              <div className="flex flex-col gap-3 border-t border-slate-200 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="px-2 text-sm text-slate-500">Editable layout, charts, and graphs</span>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800"
                >
                  Create
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Every useful output
              </h2>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {["PNG", "SVG", "PDF", "React / TSX", "JSON"].map((preset) => (
                <div
                  key={preset}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700"
                >
                  {preset}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              The editor and exports share one deterministic document, so the downloaded result stays aligned with the canvas.
            </p>
          </aside>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Start from a real job</h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose a useful starting point, then edit every part of the result.
              </p>
            </div>
            <Link
              href="/app/engine-v2"
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 sm:inline-flex"
            >
              Blank document
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STARTER_WORKFLOWS.map((workflow) => (
              <Link
                key={workflow.title}
                href={`/app/engine-v2?prompt=${encodeURIComponent(workflow.prompt)}&auto=1`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Starter</div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-700" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{workflow.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                  {workflow.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Recent projects</h2>
              <p className="mt-1 text-sm text-slate-600">
                Continue where you left off.
              </p>
            </div>
            <Clock3 className="h-4 w-4 text-slate-400" />
          </div>

          {projects.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-xs">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <Sparkles className="h-5 w-5 text-slate-500" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the prompt above or start from a template.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const isEngineV2 = project.diagramType === "engine-v2";
                const diagramType = isEngineV2 ? "freeform" : ((project.diagramType as DiagramType) ?? "freeform");
                const meta = isEngineV2 ? { label: "Engine v2" } : getDiagramTypeMeta(diagramType);
                return (
                  <div
                    key={project.id}
                    className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-md"
                  >
                    <Link
                      href={isEngineV2 ? `/app/engine-v2?id=${project.id}` : `/app/editor?id=${project.id}`}
                      className="absolute inset-0 rounded-xl"
                      aria-label={project.title}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                        <DiagramTypeIcon type={diagramType} size={18} className="text-slate-700" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-4 line-clamp-1 text-sm font-semibold text-slate-950">
                      {project.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(project.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <form action={handleDelete} className="relative z-10 mt-4">
                      <input type="hidden" name="id" value={project.id} />
                      <button
                        type="submit"
                        className="rounded-sm px-2 py-1 text-xs font-medium text-rose-500 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

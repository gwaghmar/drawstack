/**
 * MCP HTTP endpoint — drawxyz
 *
 * Exposes MCP tools over HTTP (Streamable HTTP transport) so AI IDEs like
 * Cursor and Claude Code can generate and edit diagrams directly:
 * generate_diagram, apply_ops, list_diagram_types. Every tool here is
 * stateless (source in, source out) — none of them read or write a saved
 * project; the caller owns persisting the result.
 *
 * Cursor config (~/.cursor/mcp.json):
 * {
 *   "mcpServers": {
 *     "flowchart-studio": {
 *       "url": "http://localhost:3040/api/mcp"
 *     }
 *   }
 * }
 */
import { type NextRequest, NextResponse } from "next/server";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DIAGRAM_TYPE_META, type DiagramType } from "@flowchart/core";
import { z } from "zod";
import { CanvasOpSchema, type CanvasOp } from "@/lib/diagrams/freeform-ops";
import { applyOpsToSource } from "@/lib/agent-tools";

// Tools are stateless — each request creates a fresh server instance
function buildMcpServer(): Server {
  const server = new Server(
    { name: "flowchart-studio", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "generate_diagram",
        description:
          "Generate a diagram from a natural-language prompt. Returns the freeform canvas source (JSON) ready to paste into drawxyz or save to a file.",
        inputSchema: {
          type: "object" as const,
          properties: {
            prompt: {
              type: "string",
              description: "What the diagram should show, e.g. 'User authentication flow'",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "apply_ops",
        description:
          "Apply targeted scene-graph operations (add/update/delete/connect/place/layout/reorder) to an existing freeform canvas document, targeting shapes by id or unique name. Stateless: pass the current canvas source in, get the mutated source back — this tool does not read or write any saved project.",
        inputSchema: {
          type: "object" as const,
          properties: {
            source: {
              type: "string",
              description: "The current freeform canvas document, as JSON (the same format generate_diagram returns).",
            },
            ops: {
              type: "array",
              description:
                'Ordered list of ops, each shaped like { "op": "add" | "update" | "delete" | "connect" | "place" | "layout" | "reorder", ...op-specific fields }.',
              items: { type: "object" as const },
            },
          },
          required: ["source", "ops"],
        },
      },
      {
        name: "list_diagram_types",
        description: "List all available diagram types with descriptions.",
        inputSchema: { type: "object" as const, properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "list_diagram_types") {
      const lines: string[] = ["Available diagram types:\n"];
      for (const dt of DIAGRAM_TYPE_META) {
        lines.push(`• ${dt.id} — ${dt.label}: ${dt.description}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "apply_ops") {
      const parsed = z
        .object({
          source: z.string().min(1),
          ops: z.array(CanvasOpSchema).min(1),
        })
        .safeParse(args);

      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
        };
      }

      let result: ReturnType<typeof applyOpsToSource>;
      try {
        result = applyOpsToSource(parsed.data.source, parsed.data.ops as CanvasOp[]);
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Could not parse source as a freeform canvas document: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }

      if (result.source === null) {
        return {
          isError: true,
          content: [{ type: "text", text: `No ops applied. Errors: ${JSON.stringify(result.errors)}` }],
        };
      }

      const summary = `Applied ${result.applied}/${parsed.data.ops.length} op(s).${result.errors.length ? ` Errors: ${JSON.stringify(result.errors)}` : ""}`;
      return { content: [{ type: "text", text: `${summary}\n\n${result.source}` }] };
    }

    if (name === "generate_diagram") {
      const parsed = z
        .object({
          prompt: z.string().min(1),
        })
        .safeParse(args);

      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
        };
      }

      const { prompt } = parsed.data;
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3040").replace(/\/$/, "");
      const diagramType: DiagramType = "freeform";

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/ai/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, diagramType, compact: false }),
        });
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: `Could not reach ${baseUrl}. Is the dev server running?` }],
        };
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch { /* ignore */ }
        return { isError: true, content: [{ type: "text", text: msg }] };
      }

      const data = (await res.json()) as { source?: string; error?: string };
      if (!data.source) {
        return {
          isError: true,
          content: [{ type: "text", text: data.error ?? "No diagram source returned" }],
        };
      }

      return { content: [{ type: "text", text: data.source }] };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  });

  return server;
}

async function handleRequest(req: NextRequest): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildMcpServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}

#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TEMPLATES, SOCIAL_PRESETS, getTemplateSource } from "@flowchart/core";

const server = new Server(
  {
    name: "flowchart-studio",
    version: "1.0.0",
  },
  { capabilities: { tools: {}, resources: {} } }
);

let lastSource = JSON.stringify({ version: 1, shapes: [] });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "templates_list",
      description: "List starter templates with diagram text bodies",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "social_presets_list",
      description: "List export aspect ratio presets (px)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "freeform_get_canvas",
      description: "Get the current active Freeform canvas document JSON",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "freeform_set_canvas",
      description: "Set the entire Freeform canvas document JSON",
      inputSchema: {
        type: "object",
        properties: { doc: { type: "object" } },
        required: ["doc"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "templates_list") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              TEMPLATES.map((t) => ({
                id: t.id,
                title: t.title,
                promptHint: t.promptHint,
                source: getTemplateSource(t),
              })),
              null,
              2
            ),
          },
        ],
      };
    }
    if (name === "social_presets_list") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(SOCIAL_PRESETS, null, 2),
          },
        ],
      };
    }
    if (name === "freeform_get_canvas") {
      return {
        content: [{ type: "text", text: lastSource }],
      };
    }
    if (name === "freeform_set_canvas") {
      const doc = (args as { doc?: unknown })?.doc;
      if (!doc || typeof doc !== "object") {
        return { content: [{ type: "text", text: "Invalid document JSON" }], isError: true };
      }
      lastSource = JSON.stringify(doc, null, 2);
      return { content: [{ type: "text", text: "Freeform canvas updated successfully" }] };
    }
    return {
      content: [{ type: "text", text: "Unknown tool" }],
      isError: true,
    };
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: e instanceof Error ? e.message : "Error",
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "flowchart://prompt-templates",
      name: "Prompt templates",
      mimeType: "application/json",
    },
    {
      uri: "flowchart://current-source",
      name: "Current diagram (MCP session)",
      mimeType: "text/plain",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  if (uri === "flowchart://prompt-templates") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            TEMPLATES.map((t) => ({
              id: t.id,
              title: t.title,
              promptHint: t.promptHint,
            })),
            null,
            2
          ),
        },
      ],
    };
  }
  if (uri === "flowchart://current-source") {
    return {
      contents: [{ uri, mimeType: "text/plain", text: lastSource }],
    };
  }
  throw new Error("Unknown resource");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

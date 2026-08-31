import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "drawxyz API",
    version: "1.0.0",
    description: "REST API mirroring MCP tools. Use Authorization: Bearer fc_…",
  },
  paths: {
    "/api/v1/validate": {
      post: {
        summary: "Validate a freeform canvas JSON document",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { source: { type: "string" } },
                required: ["source"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Valid freeform canvas document" },
          "400": { description: "Invalid JSON, document shape, or references" },
        },
      },
    },
    "/api/ai/generate": {
      post: {
        summary: "Generate a freeform canvas document from a prompt",
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}

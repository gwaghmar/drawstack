import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEngineV2GenerationPrompt,
  classifyEngineV2Prompt,
  compileEngineV2ModelOutput,
  validateEngineV2Document,
} from "./compiler.ts";

function validDocument(): Record<string, unknown> {
  return {
    version: 2,
    engine: "dom-css",
    name: " Revenue summary ",
    artboard: { width: 1080, minHeight: 720, background: "$paper" },
    tokens: {
      colors: { paper: "#ffffff", ink: "#111111", accent: "rgb(20, 80, 220)" },
      spacing: { sm: 8, md: 16 },
      radii: { panel: 12 },
    },
    children: [
      {
        id: "root",
        name: " Main frame ",
        type: "frame",
        layout: { mode: "grid", columns: 2, gap: 16, padding: 24 },
        style: { background: "$paper", color: "$ink", width: "100%" },
        children: [
          {
            id: "title",
            name: "Title",
            type: "text",
            content: " Revenue ",
            variant: "heading",
          },
          {
            id: "revenue",
            name: "Revenue chart",
            type: "chart",
            title: "Revenue by month",
            chartType: "line",
            valuePrefix: "$",
            data: [
              { label: "Jan", value: 10 },
              { label: "Feb", value: 14 },
            ],
          },
        ],
      },
    ],
  };
}

describe("classifyEngineV2Prompt", () => {
  it("normalizes whitespace and uses explicit chart signals", () => {
    assert.deepEqual(classifyEngineV2Prompt("  Make\n a time series chart over time  "), {
      normalizedPrompt: "Make a time series chart over time",
      composition: "chart",
      chartType: "line",
    });
    assert.equal(classifyEngineV2Prompt("Create a KPI dashboard with a bar chart").composition, "dashboard");
    assert.equal(classifyEngineV2Prompt("Show a pie chart").chartType, "donut");
    assert.equal(classifyEngineV2Prompt("Create a heatmap").chartType, "heatmap");
    assert.equal(classifyEngineV2Prompt("Build a candlestick chart").chartType, "candlestick");
    assert.equal(classifyEngineV2Prompt("Build a Sankey diagram").chartType, "sankey");
    assert.equal(classifyEngineV2Prompt("Create a waterfall chart").chartType, "waterfall");
    assert.equal(classifyEngineV2Prompt("Create a histogram").chartType, "histogram");
    assert.equal(classifyEngineV2Prompt("Create a box plot").chartType, "box-plot");
    assert.equal(classifyEngineV2Prompt("Create a bubble chart").chartType, "bubble");
    assert.equal(classifyEngineV2Prompt("Create a dual-axis chart").chartType, "combo");
    assert.equal(classifyEngineV2Prompt("Create a stacked area chart").chartType, "stacked-area");
    assert.equal(classifyEngineV2Prompt("Create a Gantt chart").chartType, "gantt");
  });

  it("does not invent a chart type when one is not specified", () => {
    assert.deepEqual(classifyEngineV2Prompt("Create a quarterly planning brief"), {
      normalizedPrompt: "Create a quarterly planning brief",
      composition: "document",
      chartType: null,
    });
  });

  it("rejects empty and oversized prompts", () => {
    assert.throws(() => classifyEngineV2Prompt(" \n "), /cannot be empty/);
    assert.throws(() => classifyEngineV2Prompt("x".repeat(4_001)), /cannot exceed/);
  });
});

describe("buildEngineV2GenerationPrompt", () => {
  it("bounds the model vocabulary and safely quotes user input", () => {
    const prompt = buildEngineV2GenerationPrompt(classifyEngineV2Prompt('Chart titled "Revenue"'));
    assert.match(prompt, /Return JSON only/);
    assert.match(prompt, /frame, text, metric, chart, and graph/);
    assert.match(prompt, /User request: "Chart titled \\"Revenue\\""/);
  });
});

describe("validateEngineV2Document", () => {
  it("returns a normalized EngineDocument", () => {
    const result = validateEngineV2Document(validDocument());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.document.name, "Revenue summary");
    assert.equal(result.document.children[0].name, "Main frame");
  });

  it("rejects unknown fields and duplicate ids", () => {
    const document = validDocument();
    document.secret = "ignored";
    const children = document.children as Array<Record<string, unknown>>;
    const root = children[0];
    const rootChildren = root.children as Array<Record<string, unknown>>;
    rootChildren[1].id = "title";
    const result = validateEngineV2Document(document);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.path === "$.secret"));
    assert.ok(result.issues.some((issue) => issue.message === "Node ids must be unique"));
  });

  it("rejects unsafe styles and unresolved tokens", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    root.style = { background: "url(https://example.com/track)", color: "$missing" };
    const result = validateEngineV2Document(document);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.issues.filter((issue) => issue.message.includes("color token")).length, 2);
  });

  it("rejects unsupported node and chart types", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    const rootChildren = root.children as Array<Record<string, unknown>>;
    rootChildren[0].type = "html";
    rootChildren[1].chartType = "map";
    const result = validateEngineV2Document(document);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.path.endsWith(".type")));
    assert.ok(result.issues.some((issue) => issue.path.endsWith(".chartType")));
  });

  it("rejects invalid layout fields and excessive chart data", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    root.layout = { mode: "flex", direction: "row", columns: 3, gap: 8, padding: 8 };
    const rootChildren = root.children as Array<Record<string, unknown>>;
    rootChildren[1].data = Array.from({ length: 121 }, (_, index) => ({ label: String(index), value: index }));
    const result = validateEngineV2Document(document);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.path.endsWith(".columns")));
    assert.ok(result.issues.some((issue) => issue.path.endsWith(".data")));
  });

  it("validates Sankey shape and rejects cyclic flows", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    const chart = (root.children as Array<Record<string, unknown>>)[1];
    chart.chartType = "sankey";
    chart.data = [
      { source: "Visitors", target: "Trials", value: 80 },
      { source: "Trials", target: "Paid", value: 30 },
    ];
    assert.equal(validateEngineV2Document(document).ok, true);

    chart.data = [
      { source: "A", target: "B", value: 3 },
      { source: "B", target: "A", value: 2 },
    ];
    const cyclic = validateEngineV2Document(document);
    assert.equal(cyclic.ok, false);
    if (!cyclic.ok) assert.ok(cyclic.issues.some((issue) => issue.message === "Sankey data must be acyclic"));

    chart.data = [{ label: "Not a flow", value: 3 }];
    const wrongShape = validateEngineV2Document(document);
    assert.equal(wrongShape.ok, false);
    if (!wrongShape.ok) assert.ok(wrongShape.issues.some((issue) => issue.message.includes("Sankey data must use")));
  });

  it("validates statistical chart data contracts", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    const chart = (root.children as Array<Record<string, unknown>>)[1];
    chart.chartType = "box-plot";
    chart.data = [{ label: "Latency", min: 2, q1: 4, median: 5, q3: 7, max: 10 }];
    assert.equal(validateEngineV2Document(document).ok, true);
    chart.data = [{ label: "Latency", min: 2, q1: 7, median: 5, q3: 8, max: 10 }];
    assert.equal(validateEngineV2Document(document).ok, false);

    chart.chartType = "histogram";
    chart.data = [{ value: 1 }, { value: 2 }];
    assert.equal(validateEngineV2Document(document).ok, true);
    chart.chartType = "bubble";
    chart.data = [{ x: 1, y: 2, size: 5, label: "A" }];
    assert.equal(validateEngineV2Document(document).ok, true);
    chart.data = [{ x: 1, y: 2, size: 0 }];
    assert.equal(validateEngineV2Document(document).ok, false);
  });

  it("validates combo, stacked area, and Gantt contracts", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    const chart = (root.children as Array<Record<string, unknown>>)[1];
    chart.chartType = "combo";
    chart.data = [
      { label: "Jan", value: 10, series: "Revenue", display: "bar" },
      { label: "Jan", value: 20, series: "Margin", display: "line", axis: "right" },
    ];
    assert.equal(validateEngineV2Document(document).ok, true);
    chart.data = [{ label: "Jan", value: 10, series: "Revenue", display: "bar" }];
    assert.equal(validateEngineV2Document(document).ok, false);

    chart.chartType = "stacked-area";
    chart.data = [
      { label: "Jan", value: 10, series: "Core" },
      { label: "Jan", value: 2, series: "Expansion" },
      { label: "Feb", value: 12, series: "Core" },
      { label: "Feb", value: 3, series: "Expansion" },
    ];
    assert.equal(validateEngineV2Document(document).ok, true);

    chart.chartType = "gantt";
    chart.data = [{ label: "Build", start: "2026-01-01", end: "2026-01-20" }];
    assert.equal(validateEngineV2Document(document).ok, true);
    chart.data = [{ label: "Build", start: "Jan 1", end: "Jan 20" }];
    assert.equal(validateEngineV2Document(document).ok, false);
  });
});

describe("compileEngineV2ModelOutput", () => {
  it("accepts exact JSON and a single JSON fence", () => {
    const json = JSON.stringify(validDocument());
    assert.equal(compileEngineV2ModelOutput("Make a line chart", json).ok, true);
    assert.equal(compileEngineV2ModelOutput("Make a line chart", `\`\`\`json\n${json}\n\`\`\``).ok, true);
  });

  it("rejects prose, malformed JSON, and invalid prompts", () => {
    assert.equal(compileEngineV2ModelOutput("Make a chart", `Here it is: ${JSON.stringify(validDocument())}`).ok, false);
    assert.equal(compileEngineV2ModelOutput("Make a chart", "{broken").ok, false);
    const result = compileEngineV2ModelOutput(" ", JSON.stringify(validDocument()));
    assert.equal(result.ok, false);
    assert.equal(result.intent, null);
  });

  it("rejects output that conflicts with an explicit chart request", () => {
    const document = validDocument();
    const root = (document.children as Array<Record<string, unknown>>)[0];
    const rootChildren = root.children as Array<Record<string, unknown>>;
    rootChildren[1].chartType = "bar";
    const result = compileEngineV2ModelOutput("Make a line chart", JSON.stringify(document));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.message === "The request requires a line chart"));
  });
});

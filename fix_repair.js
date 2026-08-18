const fs = require('fs');

let content = fs.readFileSync('apps/web/app/api/ai/repair-node/route.ts', 'utf8');
content = content.replace(
  'import { openRouter } from "@/lib/ai-providers";',
  'import { buildLanguageModel } from "@/lib/ai-providers";'
);
content = content.replace(
  'model: openRouter("anthropic/claude-3.5-sonnet"),',
  'model: buildLanguageModel("openai", "gpt-4o-mini", process.env.OPENAI_API_KEY || "ollama"),'
);
fs.writeFileSync('apps/web/app/api/ai/repair-node/route.ts', content, 'utf8');
console.log("Fixed repair-node route");

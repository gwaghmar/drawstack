const fs = require('fs');
let content = fs.readFileSync('packages/core/src/templates.ts', 'utf8');
content = content.replace("  },\n,\n  {", "  },\n  {");
fs.writeFileSync('packages/core/src/templates.ts', content, 'utf8');

const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import { cn } from "@\/lib\/utils";/g, '');
  content = content.replace(/cn\(([\s\S]*?)\)/g, (match, p1) => {
    return `[${p1.trim()}].filter(Boolean).join(" ")`;
  });
  fs.writeFileSync(file, content, 'utf8');
}

fixFile('apps/web/components/canvas-ui/Toggle.tsx');
fixFile('apps/web/components/canvas-ui/Form.tsx');
fixFile('apps/web/components/canvas-ui/Slider.tsx');
fixFile('apps/web/components/canvas-ui/Select.tsx');
console.log("Fixed cn multiline");

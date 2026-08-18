const fs = require('fs');

function addCn(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('const cn =')) {
    content = content.replace(
      'import { useTheme } from "./ThemeProvider";',
      'import { useTheme } from "./ThemeProvider";\n\nconst cn = (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" ");'
    );
    fs.writeFileSync(file, content, 'utf8');
  }
}

addCn('apps/web/components/canvas-ui/Form.tsx');
addCn('apps/web/components/canvas-ui/Slider.tsx');
addCn('apps/web/components/canvas-ui/Toggle.tsx');
addCn('apps/web/components/canvas-ui/Select.tsx');
console.log("Added cn");

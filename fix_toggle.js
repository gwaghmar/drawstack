const fs = require('fs');

const toggleContent = `import React from "react";
import { useTheme } from "./ThemeProvider";

const cn = (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" ");

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Toggle({ checked, onChange, className }: ToggleProps) {
  const { theme } = useTheme();

  const handleToggle = () => onChange(!checked);

  const themeClasses = {
    editorial: cn(
      "w-12 h-6 rounded-full border-2 transition-colors",
      checked ? "bg-black border-black" : "bg-white border-slate-300"
    ),
    brutalist: cn(
      "w-14 h-8 border-4 border-black transition-colors shadow-[4px_4px_0_0_rgba(0,0,0,1)]",
      checked ? "bg-[#00FF00]" : "bg-white"
    ),
    retro: cn(
      "w-12 h-6 border-2 transition-colors relative",
      checked ? "bg-cyan-500/20 border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.5)]" : "bg-black border-cyan-900"
    ),
    wireframe: cn(
      "w-12 h-6 border-2 transition-colors rounded-sm",
      checked ? "bg-slate-500 border-slate-500" : "bg-white border-slate-300"
    ),
    glass: cn(
      "w-14 h-8 rounded-full border border-white/40 transition-colors backdrop-blur-md shadow-inner",
      checked ? "bg-indigo-500/80" : "bg-white/20"
    ),
  };

  const knobClasses = {
    editorial: cn(
      "w-4 h-4 rounded-full bg-white border-2 border-transparent transition-transform transform mt-0.5 ml-0.5",
      checked ? "translate-x-6 border-black" : "bg-slate-300"
    ),
    brutalist: cn(
      "w-6 h-6 bg-black transition-transform transform mt-[2px] ml-[2px]",
      checked ? "translate-x-6" : ""
    ),
    retro: cn(
      "w-4 h-4 bg-cyan-400 transition-transform transform mt-[2px] ml-[2px]",
      checked ? "translate-x-6 shadow-[0_0_8px_#00ffff]" : "bg-cyan-900"
    ),
    wireframe: cn(
      "w-4 h-4 bg-white border-2 border-slate-500 transition-transform transform mt-0.5 ml-0.5",
      checked ? "translate-x-6" : "border-slate-300 bg-slate-200"
    ),
    glass: cn(
      "w-6 h-6 rounded-full bg-white shadow-md transition-transform transform mt-[3px] ml-[3px]",
      checked ? "translate-x-6" : ""
    ),
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleToggle}
      className={cn("relative flex items-start shrink-0 cursor-pointer outline-none", themeClasses[theme], className)}
    >
      <span className={knobClasses[theme]} />
    </button>
  );
}
`;
fs.writeFileSync('apps/web/components/canvas-ui/Toggle.tsx', toggleContent, 'utf8');

// I also need to fix the other files where my regex might have broken them (Form, Slider, Select).
// Let's just fix them all properly by restoring them and prepending the cn function.
console.log("Fixed toggle");

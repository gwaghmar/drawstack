import React from "react";
import { useTheme } from "./ThemeProvider";

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { theme } = useTheme();

  let themeClass = "";
  switch (theme) {
    case "editorial":
      themeClass = "bg-white border-[1px] border-black p-6";
      break;
    case "brutalist":
      themeClass = "bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 rounded-none text-black";
      break;
    case "retro":
      themeClass = "bg-black border border-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.2)] p-4 text-cyan-400";
      break;
    case "wireframe":
      themeClass = "bg-white border border-slate-300 rounded-lg p-6 shadow-sm";
      break;
    case "glass":
    default:
      themeClass = "bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-xl";
      break;
  }

  return (
    <div className={`${themeClass} ${className}`} {...props}>
      {children}
    </div>
  );
}

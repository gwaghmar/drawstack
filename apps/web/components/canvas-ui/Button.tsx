import React from "react";
import { useTheme } from "./ThemeProvider";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const { theme } = useTheme();

  let themeClass = "";
  switch (theme) {
    case "editorial":
      themeClass = variant === "primary"
        ? "bg-black text-white rounded-none px-6 py-2 uppercase tracking-widest text-sm"
        : "bg-transparent text-black border border-black rounded-none px-6 py-2 uppercase tracking-widest text-sm";
      break;
    case "brutalist":
      themeClass = variant === "primary"
        ? "bg-[#FFEB3B] text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase text-lg hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
        : "bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase text-lg hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all";
      break;
    case "retro":
      themeClass = variant === "primary"
        ? "bg-cyan-500 text-black px-4 py-2 font-mono uppercase border border-cyan-500 shadow-[0_0_8px_rgba(0,255,255,0.6)]"
        : "bg-transparent text-cyan-500 px-4 py-2 font-mono uppercase border border-cyan-500 hover:bg-cyan-900/30";
      break;
    case "wireframe":
      themeClass = variant === "primary"
        ? "bg-slate-800 text-white px-4 py-2 rounded-md font-medium hover:bg-slate-900"
        : "bg-white text-slate-700 px-4 py-2 rounded-md font-medium border border-slate-300 hover:bg-slate-50";
      break;
    case "glass":
    default:
      themeClass = variant === "primary"
        ? "bg-black/80 backdrop-blur-md text-white px-6 py-2.5 rounded-full font-medium shadow-lg hover:bg-black/90 transition-colors"
        : "bg-white/50 backdrop-blur-md text-slate-900 border border-white/40 px-6 py-2.5 rounded-full font-medium shadow-sm hover:bg-white/60 transition-colors";
      break;
  }

  return (
    <button className={`${themeClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

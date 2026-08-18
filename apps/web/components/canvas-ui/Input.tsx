import React from "react";
import { useTheme } from "./ThemeProvider";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className = "", error, ...props }: InputProps) {
  const { theme } = useTheme();

  let themeClass = "";
  switch (theme) {
    case "editorial":
      themeClass = "bg-transparent border-b-2 border-black rounded-none px-0 py-2 focus:outline-none focus:border-gray-500 placeholder:text-gray-400 font-serif";
      break;
    case "brutalist":
      themeClass = "bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-3 rounded-none focus:outline-none focus:bg-yellow-100 font-bold placeholder:text-black/50";
      if (error) themeClass += " border-red-500 bg-red-100";
      break;
    case "retro":
      themeClass = "bg-black border border-cyan-500 text-cyan-400 px-3 py-2 focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,255,0.6)] font-mono placeholder:text-cyan-800";
      break;
    case "wireframe":
      themeClass = "bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400";
      break;
    case "glass":
    default:
      themeClass = "bg-white/50 backdrop-blur-md border border-white/40 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/60 placeholder:text-slate-500 shadow-sm";
      break;
  }

  return <input className={`${themeClass} ${className}`} {...props} />;
}

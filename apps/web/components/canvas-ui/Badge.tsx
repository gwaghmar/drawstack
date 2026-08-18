import React from "react";
import { useTheme } from "./ThemeProvider";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "danger" | "warning";
}

export function Badge({ variant = "neutral", className = "", children, ...props }: BadgeProps) {
  const { theme } = useTheme();

  let themeClass = "";
  switch (theme) {
    case "editorial":
      themeClass = "bg-black text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-none";
      break;
    case "brutalist":
      let bgColor = "bg-white";
      if (variant === "success") bgColor = "bg-[#00FF00]";
      if (variant === "danger") bgColor = "bg-[#FF0000]";
      if (variant === "warning") bgColor = "bg-[#FFEB3B]";
      themeClass = `${bgColor} text-black border-2 border-black px-2 py-1 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none`;
      break;
    case "retro":
      let retroColor = "text-cyan-500 border-cyan-500 bg-cyan-900/30";
      if (variant === "success") retroColor = "text-green-500 border-green-500 bg-green-900/30";
      if (variant === "danger") retroColor = "text-red-500 border-red-500 bg-red-900/30";
      if (variant === "warning") retroColor = "text-yellow-500 border-yellow-500 bg-yellow-900/30";
      themeClass = `${retroColor} px-2 py-0.5 text-xs font-mono border rounded-none`;
      break;
    case "wireframe":
      let wfColor = "bg-slate-100 text-slate-700";
      if (variant === "success") wfColor = "bg-emerald-100 text-emerald-700";
      if (variant === "danger") wfColor = "bg-rose-100 text-rose-700";
      if (variant === "warning") wfColor = "bg-amber-100 text-amber-700";
      themeClass = `${wfColor} px-2.5 py-0.5 text-xs font-medium rounded-full`;
      break;
    case "glass":
    default:
      let glassColor = "bg-white/40 text-slate-800 border-white/40";
      if (variant === "success") glassColor = "bg-emerald-500/20 text-emerald-800 border-emerald-500/20";
      if (variant === "danger") glassColor = "bg-rose-500/20 text-rose-800 border-rose-500/20";
      if (variant === "warning") glassColor = "bg-amber-500/20 text-amber-800 border-amber-500/20";
      themeClass = `${glassColor} backdrop-blur-md px-3 py-1 text-xs font-medium border rounded-full shadow-sm`;
      break;
  }

  return (
    <span className={`inline-flex items-center justify-center ${themeClass} ${className}`} {...props}>
      {children}
    </span>
  );
}

import React from "react";
import { useTheme } from "./ThemeProvider";

interface TypographyProps extends React.HTMLAttributes<HTMLHeadingElement | HTMLParagraphElement> {
  variant?: "h1" | "h2" | "h3" | "h4" | "body" | "caption";
}

export function Typography({ variant = "body", className = "", children, ...props }: TypographyProps) {
  const { theme } = useTheme();

  let themeClass = "";
  
  if (theme === "editorial") {
    switch (variant) {
      case "h1": themeClass = "text-6xl font-black font-sans tracking-tighter mb-4 text-black uppercase"; break;
      case "h2": themeClass = "text-4xl font-bold font-sans tracking-tight mb-3 text-black"; break;
      case "h3": themeClass = "text-2xl font-bold font-sans mb-2 text-black"; break;
      case "h4": themeClass = "text-sm font-bold font-sans uppercase tracking-widest mb-2 text-gray-500"; break;
      case "body": themeClass = "text-base font-serif text-gray-800 leading-relaxed mb-4"; break;
      case "caption": themeClass = "text-xs font-sans text-gray-500 uppercase tracking-wider"; break;
    }
  } else if (theme === "brutalist") {
    switch (variant) {
      case "h1": themeClass = "text-7xl font-black uppercase tracking-tighter mb-6 text-black leading-none"; break;
      case "h2": themeClass = "text-5xl font-black uppercase tracking-tight mb-4 text-black"; break;
      case "h3": themeClass = "text-3xl font-bold uppercase mb-2 text-black"; break;
      case "h4": themeClass = "text-xl font-bold uppercase mb-2 bg-black text-white inline-block px-2"; break;
      case "body": themeClass = "text-lg font-medium text-black mb-4 border-l-4 border-black pl-4"; break;
      case "caption": themeClass = "text-sm font-bold uppercase text-gray-800"; break;
    }
  } else if (theme === "retro") {
    switch (variant) {
      case "h1": themeClass = "text-4xl font-mono mb-4 text-cyan-400 uppercase tracking-widest border-b border-cyan-800 pb-2"; break;
      case "h2": themeClass = "text-2xl font-mono mb-3 text-cyan-500 uppercase"; break;
      case "h3": themeClass = "text-xl font-mono mb-2 text-cyan-500"; break;
      case "h4": themeClass = "text-sm font-mono mb-2 text-cyan-600"; break;
      case "body": themeClass = "text-sm font-mono text-cyan-300 mb-4"; break;
      case "caption": themeClass = "text-xs font-mono text-cyan-700"; break;
    }
  } else if (theme === "wireframe") {
    switch (variant) {
      case "h1": themeClass = "text-3xl font-bold mb-4 text-slate-800"; break;
      case "h2": themeClass = "text-2xl font-semibold mb-3 text-slate-800"; break;
      case "h3": themeClass = "text-lg font-medium mb-2 text-slate-700"; break;
      case "h4": themeClass = "text-sm font-medium mb-2 text-slate-500"; break;
      case "body": themeClass = "text-sm text-slate-600 mb-4"; break;
      case "caption": themeClass = "text-xs text-slate-400"; break;
    }
  } else {
    // Glass / Soft Modern
    switch (variant) {
      case "h1": themeClass = "text-4xl font-bold tracking-tight mb-4 text-slate-900"; break;
      case "h2": themeClass = "text-2xl font-semibold tracking-tight mb-3 text-slate-800"; break;
      case "h3": themeClass = "text-lg font-medium mb-2 text-slate-800"; break;
      case "h4": themeClass = "text-sm font-medium uppercase tracking-wider mb-2 text-slate-500"; break;
      case "body": themeClass = "text-base text-slate-600 mb-4 leading-relaxed"; break;
      case "caption": themeClass = "text-sm text-slate-500"; break;
    }
  }

  const Tag = variant.startsWith("h") ? variant : (variant === "caption" ? "span" : "p") as any;

  return (
    <Tag className={`${themeClass} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

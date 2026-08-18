"use client";

import React, { createContext, useContext } from "react";

export type Theme = "editorial" | "brutalist" | "retro" | "wireframe" | "glass";

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "glass" });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ theme = "glass", children }: { theme?: Theme; children: React.ReactNode }) {
  // Apply root variables or wrapper classes based on theme
  let wrapperClass = "h-full w-full overflow-auto ";

  switch (theme) {
    case "editorial":
      wrapperClass += "bg-white text-black font-serif"; // Swiss grid, classic
      break;
    case "brutalist":
      wrapperClass += "bg-black text-white font-sans"; // High contrast neo-brutalism
      break;
    case "retro":
      wrapperClass += "bg-[#1E1E1E] text-[#00FF00] font-mono"; // Terminal/HUD style
      break;
    case "wireframe":
      wrapperClass += "bg-slate-50 text-slate-800 font-sans"; // Clinical diagram
      break;
    case "glass":
    default:
      wrapperClass += "bg-transparent text-slate-900 font-sans"; // Soft modern
      break;
  }

  return (
    <ThemeContext.Provider value={{ theme }}>
      <div className={wrapperClass}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

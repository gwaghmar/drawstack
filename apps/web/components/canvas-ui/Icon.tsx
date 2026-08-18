import React from "react";
import * as LucideIcons from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number | string;
  className?: string;
}

export function Icon({ name, size = 24, className = "", ...props }: IconProps) {
  const { theme } = useTheme();
  
  // Try to find the exact icon, fallback to a default if not found to prevent crashes
  const LucideIcon = (LucideIcons as any)[name] || LucideIcons.HelpCircle;

  let themeClass = "";
  if (theme === "brutalist") {
    themeClass = "stroke-black stroke-[3px]";
  } else if (theme === "retro") {
    themeClass = "stroke-cyan-400";
  } else if (theme === "wireframe") {
    themeClass = "stroke-slate-600";
  } else if (theme === "editorial") {
    themeClass = "stroke-black";
  } else {
    // Glass
    themeClass = "stroke-slate-800";
  }

  return (
    <LucideIcon
      size={size}
      className={`${themeClass} ${className}`}
      {...props}
    />
  );
}

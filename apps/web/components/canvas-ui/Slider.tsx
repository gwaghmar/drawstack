import React from "react";
import { useTheme } from "./ThemeProvider";

const cn = (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" ");


interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: number;
  min?: number;
  max?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Slider({ value, min = 0, max = 100, onChange, className, ...props }: SliderProps) {
  const { theme } = useTheme();

  const themeClasses = {
    editorial: "accent-black h-1 bg-slate-200 rounded-none",
    brutalist: "accent-black h-4 bg-yellow-300 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]",
    retro: "accent-cyan-400 h-2 bg-cyan-950 border border-cyan-800",
    wireframe: "accent-slate-500 h-2 bg-slate-200 rounded-none",
    glass: "accent-indigo-500 h-2 bg-white/30 backdrop-blur-md rounded-full",
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      className={["w-full appearance-none cursor-pointer outline-none", themeClasses[theme], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

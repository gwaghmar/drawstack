import React from "react";
import { useTheme } from "./ThemeProvider";

const cn = (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" ");


interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export function Select({ options, className, ...props }: SelectProps) {
  const { theme } = useTheme();

  const themeClasses = {
    editorial: "border-b-2 border-black bg-transparent text-lg focus:outline-none py-2",
    brutalist: "border-4 border-black bg-white p-3 font-bold uppercase shadow-[4px_4px_0_0_rgba(0,0,0,1)] focus:outline-none focus:bg-yellow-300",
    retro: "bg-black border-2 border-cyan-800 text-cyan-400 p-2 font-mono focus:outline-none focus:border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]",
    wireframe: "border border-slate-400 bg-white p-2 text-sm focus:outline-none focus:border-slate-800 rounded-sm",
    glass: "bg-white/30 border border-white/50 backdrop-blur-md p-3 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm",
  };

  return (
    <div className="relative inline-block w-full">
      <select
        className={["w-full appearance-none cursor-pointer", themeClasses[theme], className].filter(Boolean).join(" ")}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-black bg-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
}

import React from "react";
import { useTheme } from "./ThemeProvider";

interface DataTableProps {
  columns: string[];
  data: (string | number | React.ReactNode)[][];
  className?: string;
}

export function DataTable({ columns, data, className = "" }: DataTableProps) {
  const { theme } = useTheme();

  let tableClass = "w-full text-left border-collapse";
  let thClass = "";
  let tdClass = "";
  let trClass = "";

  switch (theme) {
    case "editorial":
      thClass = "border-b-2 border-black py-3 px-4 font-bold uppercase tracking-widest text-xs text-black";
      tdClass = "border-b border-gray-200 py-3 px-4 text-sm font-serif text-gray-800";
      break;
    case "brutalist":
      tableClass += " border-[3px] border-black bg-white";
      thClass = "border-[3px] border-black bg-[#FFEB3B] py-3 px-4 font-black uppercase text-black text-lg";
      tdClass = "border-b-[3px] border-black py-4 px-4 font-bold text-black";
      trClass = "border-[3px] border-black";
      break;
    case "retro":
      tableClass += " border border-cyan-800";
      thClass = "border-b border-cyan-500 py-2 px-3 font-mono text-cyan-300 text-sm uppercase bg-cyan-900/30";
      tdClass = "border-b border-cyan-900/50 py-2 px-3 font-mono text-cyan-500 text-sm";
      trClass = "hover:bg-cyan-900/20";
      break;
    case "wireframe":
      tableClass += " border border-slate-200 rounded-md overflow-hidden";
      thClass = "bg-slate-100 border-b border-slate-200 py-2 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider";
      tdClass = "border-b border-slate-100 py-3 px-4 text-sm text-slate-700";
      trClass = "hover:bg-slate-50";
      break;
    case "glass":
    default:
      tableClass += " border-hidden";
      thClass = "py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200/50";
      tdClass = "py-3 px-4 text-sm text-slate-700 border-b border-slate-200/50";
      trClass = "hover:bg-white/40 transition-colors";
      break;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={tableClass}>
        <thead>
          <tr className={trClass}>
            {columns.map((col, i) => (
              <th key={i} className={thClass}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={trClass}>
              {row.map((cell, j) => (
                <td key={j} className={tdClass}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

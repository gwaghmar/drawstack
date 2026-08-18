import React, { useState } from "react";
import { useTheme } from "./ThemeProvider";

interface TabsProps {
  tabs: string[];
  activeTab?: string;
  onChange?: (tab: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  const { theme } = useTheme();
  // Internal state fallback if uncontrolled
  const [internalActive, setInternalActive] = useState(tabs[0]);
  
  const current = activeTab !== undefined ? activeTab : internalActive;

  const handleClick = (tab: string) => {
    setInternalActive(tab);
    if (onChange) onChange(tab);
  };

  let containerClass = "flex";
  let getTabClass = (isActive: boolean) => "";

  switch (theme) {
    case "editorial":
      containerClass += " border-b border-black gap-6";
      getTabClass = (isActive) => `pb-2 text-sm font-bold uppercase tracking-widest cursor-pointer ${isActive ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`;
      break;
    case "brutalist":
      containerClass += " gap-0 border-[3px] border-black bg-white inline-flex shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";
      getTabClass = (isActive) => `px-6 py-2 font-bold uppercase cursor-pointer border-r-[3px] border-black last:border-r-0 ${isActive ? 'bg-[#FFEB3B] text-black' : 'hover:bg-gray-100 text-black'}`;
      break;
    case "retro":
      containerClass += " gap-2";
      getTabClass = (isActive) => `px-4 py-1 font-mono text-sm cursor-pointer border ${isActive ? 'border-cyan-500 bg-cyan-900/50 text-cyan-300' : 'border-transparent text-cyan-600 hover:text-cyan-400 hover:border-cyan-800'}`;
      break;
    case "wireframe":
      containerClass += " gap-2 border-b border-slate-200";
      getTabClass = (isActive) => `px-4 py-2 text-sm font-medium cursor-pointer rounded-t-md ${isActive ? 'bg-slate-100 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`;
      break;
    case "glass":
    default:
      containerClass += " gap-1 p-1 bg-black/5 backdrop-blur-md rounded-xl inline-flex border border-white/20";
      getTabClass = (isActive) => `px-4 py-1.5 text-sm font-medium cursor-pointer rounded-lg transition-all ${isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`;
      break;
  }

  return (
    <div className={`${containerClass} ${className}`}>
      {tabs.map((tab) => (
        <div key={tab} className={getTabClass(current === tab)} onClick={() => handleClick(tab)}>
          {tab}
        </div>
      ))}
    </div>
  );
}

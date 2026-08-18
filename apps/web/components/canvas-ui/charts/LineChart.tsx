import React from "react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../ThemeProvider";

interface LineChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
}

export function LineChart({ data, xKey, yKey, height = 300 }: LineChartProps) {
  const { theme } = useTheme();

  let color = "#3b82f6";
  let gridColor = "#e2e8f0";
  let textColor = "#64748b";

  if (theme === "brutalist") {
    color = "#FF0000";
    gridColor = "#000000";
    textColor = "#000000";
  } else if (theme === "retro") {
    color = "#00FF00";
    gridColor = "#164e63"; // cyan-900
    textColor = "#22d3ee"; // cyan-400
  } else if (theme === "editorial") {
    color = "#000000";
    gridColor = "#e5e7eb";
    textColor = "#374151";
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray={theme === "retro" ? "3 3" : "0"} stroke={gridColor} vertical={false} />
          <XAxis dataKey={xKey} stroke={textColor} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke={textColor} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: theme === "brutalist" || theme === "editorial" ? "#fff" : (theme === "retro" ? "#000" : "rgba(255,255,255,0.8)"),
              border: theme === "brutalist" || theme === "editorial" ? "2px solid #000" : (theme === "retro" ? "1px solid #00ff00" : "1px solid #e2e8f0"),
              boxShadow: theme === "brutalist" ? "4px 4px 0 0 #000" : "none",
              color: theme === "retro" ? "#00ff00" : "#000"
            }}
          />
          <Line 
            type="monotone" 
            dataKey={yKey} 
            stroke={color} 
            strokeWidth={theme === "brutalist" || theme === "retro" ? 3 : 2} 
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} 
            activeDot={{ r: 6 }} 
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

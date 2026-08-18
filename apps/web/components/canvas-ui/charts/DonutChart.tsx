import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../ThemeProvider";

interface DonutChartProps {
  data: { name: string; value: number }[];
  height?: number;
}

export function DonutChart({ data, height = 300 }: DonutChartProps) {
  const { theme } = useTheme();

  // Color palettes based on theme
  let colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  
  if (theme === "brutalist") {
    colors = ["#FFEB3B", "#FF0000", "#000000", "#FFFFFF"];
  } else if (theme === "retro") {
    colors = ["#00FF00", "#06b6d4", "#facc15", "#ef4444"];
  } else if (theme === "editorial") {
    colors = ["#000000", "#4b5563", "#9ca3af", "#d1d5db"];
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.25}
            outerRadius={height * 0.4}
            paddingAngle={theme === "brutalist" ? 0 : 5}
            dataKey="value"
            stroke={theme === "brutalist" || theme === "editorial" ? "#000" : "none"}
            strokeWidth={theme === "brutalist" ? 2 : 0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: theme === "brutalist" || theme === "editorial" ? "#fff" : (theme === "retro" ? "#000" : "rgba(255,255,255,0.8)"),
              border: theme === "brutalist" || theme === "editorial" ? "2px solid #000" : (theme === "retro" ? "1px solid #00ff00" : "1px solid #e2e8f0"),
              boxShadow: theme === "brutalist" ? "4px 4px 0 0 #000" : "none",
              color: theme === "retro" ? "#00ff00" : "#000"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

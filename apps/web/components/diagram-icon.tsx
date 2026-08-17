"use client";

import {
  GitFork,
  PencilRuler,
  Network,
  BarChart2,
  AreaChart,
  Workflow,
  Cloud,
  Database,
  Users,
  Milestone,
  Columns2,
  Grid2x2,
  Filter,
  CircleDot,
  ListOrdered,
  Triangle,
  LayoutGrid,
  PieChart,
  CheckSquare,
  Hash,
  Trophy,
  Shapes,
  Share2,
  Atom,
  Layers,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { DiagramType } from "@flowchart/core";

/** Render icon by DiagramType id */
export function DiagramTypeIcon({ type, className, size }: { type: DiagramType; className?: string; size?: number }) {
  const iconMap: Record<DiagramType, LucideIcon> = {
    mermaid: GitFork,
    excalidraw: PencilRuler,
    reactflow: Network,
    echarts: BarChart2,
    nivo: AreaChart,
    bpmn: Workflow,
    cloud: Cloud,
    erd: Database,
    orgchart: Users,
    timeline: Milestone,
    versus: Columns2,
    matrix2x2: Grid2x2,
    funnel: Filter,
    venn: CircleDot,
    tierlist: ListOrdered,
    iceberg: Triangle,
    alignment: LayoutGrid,
    budget: PieChart,
    habits: CheckSquare,
    bingo: Hash,
    bracket: Trophy,
    freeform: Shapes,
    d3: GitFork,
    cytoscape: Share2,
    visnetwork: Atom,
    fabric: Layers,
    pixi: Zap,
  };
  const Icon = iconMap[type] ?? GitFork;
  return <Icon size={size ?? 18} className={className} />;
}

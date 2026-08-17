"use client";

import { Shapes } from "lucide-react";
import type { DiagramType } from "@flowchart/core";

/** Render icon by DiagramType id */
export function DiagramTypeIcon({ type: _type, className, size }: { type: DiagramType; className?: string; size?: number }) {
  return <Shapes size={size ?? 18} className={className} />;
}

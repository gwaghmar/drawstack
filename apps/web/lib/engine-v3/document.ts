import type { EngineNode as EngineV2Node, EngineTokens as EngineV2Tokens } from "../engine-v2/document.ts";

export type Paint = string;
export type TokenValue<T> = { value: T; alias?: string; fallback?: T };
export type TokenSet = {
  colors: Record<string, TokenValue<Paint>>;
  spacing: Record<string, TokenValue<number>>;
  radii: Record<string, TokenValue<number>>;
  typography: Record<string, TokenValue<Record<string, string | number>>>;
  shadows: Record<string, TokenValue<string>>;
  motion: Record<string, TokenValue<Record<string, string | number>>>;
};

export type AssetRef = {
  sha256: string;
  mime: string;
  width?: number;
  height?: number;
  source: string;
  license?: string;
};

export type ComponentSlot = { id: string; name: string; accepts: string[] };
export type ComponentDefinition = {
  id: string;
  name: string;
  root: EngineNode;
  slots: ComponentSlot[];
  variants: Record<string, string[]>;
};
export type ComponentInstance = EngineNode & {
  componentRef: string;
  instanceOverrides: Record<string, unknown>;
};

export type ViewportState = { x: number; y: number; zoom: number };
export type Page = {
  id: string;
  name: string;
  width: number;
  height: number | "auto";
  background: Paint;
  root: EngineFrameNode;
  viewport?: ViewportState;
};

export type EngineNode = EngineV2Node & {
  transform?: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number };
  opacity?: number;
  blendMode?: string;
  styleRef?: string;
  componentRef?: string;
  instanceOverrides?: Record<string, unknown>;
  assetRef?: string;
};
export type EngineFrameNode = Extract<EngineNode, { type: "frame" }>;

export type EngineDocumentV3 = {
  version: 3;
  engine: "dom-css";
  metadata: { id: string; name: string; createdAt: string; updatedAt: string };
  tokens: TokenSet;
  assets: Record<string, AssetRef>;
  components: Record<string, ComponentDefinition>;
  pages: Page[];
};

export function typedTokens(tokens: EngineV2Tokens): TokenSet {
  const typed = <T>(values: Record<string, T>): Record<string, TokenValue<T>> => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
  return { colors: typed(tokens.colors), spacing: typed(tokens.spacing), radii: typed(tokens.radii), typography: {}, shadows: {}, motion: {} };
}

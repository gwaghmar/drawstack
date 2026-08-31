import type { AssetRef } from "./document.ts";
import { sha256Hex } from "./components.ts";

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_ASSET_DIMENSION = 8192;
export type AssetIngestionInput = {
  content: string | ArrayBuffer | Uint8Array;
  mime: string;
  source: string;
  license?: string;
  width?: number;
  height?: number;
};
export type IngestedAsset = { asset: AssetRef; previewSource: string };

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"]);
const bytesOf = (content: string | ArrayBuffer | Uint8Array): Uint8Array => typeof content === "string" ? new TextEncoder().encode(content) : content instanceof Uint8Array ? content : new Uint8Array(content);
const base64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let index = 0; index < binary.length; index += 3) {
    const a = binary.charCodeAt(index);
    const b = index + 1 < binary.length ? binary.charCodeAt(index + 1) : 0;
    const c = index + 2 < binary.length ? binary.charCodeAt(index + 2) : 0;
    result += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)] + (index + 1 < binary.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") + (index + 2 < binary.length ? alphabet[c & 63] : "=");
  }
  return result;
};

export function sanitizeSvg(source: string): string {
  if (/<\s*script\b|\bon[a-z]+\s*=|javascript\s*:|<\s*foreignObject\b|<(?:iframe|object|embed)\b/i.test(source)) throw new Error("SVG contains executable content");
  const sanitized = source
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\s(?:href|xlink:href|src)\s*=\s*(["'])\s*(?:https?:|data:text\/html|javascript:)[^"']*\1/gi, "")
    .replace(/url\(\s*["']?(?:https?:|data:)[^)]*\)?/gi, "none");
  if (/<\s*style\b[^>]*>[^]*?(?:@import|url\(\s*(?:https?:|data:))[^]*?<\s*\/style\s*>/i.test(sanitized)) throw new Error("SVG contains external references");
  return sanitized;
}

export async function ingestAsset(input: AssetIngestionInput): Promise<IngestedAsset> {
  if (!IMAGE_MIMES.has(input.mime)) throw new Error("Unsupported asset MIME type");
  const bytes = bytesOf(input.content);
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error("Asset exceeds maximum size");
  for (const dimension of [input.width, input.height]) if (dimension !== undefined && (!Number.isFinite(dimension) || dimension <= 0 || dimension > MAX_ASSET_DIMENSION)) throw new Error("Asset dimensions are unsafe");
  const raw = new TextDecoder().decode(bytes);
  const safeBytes = input.mime === "image/svg+xml" ? new TextEncoder().encode(sanitizeSvg(raw)) : bytes;
  const sha256 = await sha256Hex(safeBytes.slice().buffer as ArrayBuffer);
  const asset: AssetRef = { sha256, mime: input.mime, source: input.source, ...(input.license ? { license: input.license } : {}), ...(input.width ? { width: input.width } : {}), ...(input.height ? { height: input.height } : {}) };
  return { asset, previewSource: "data:" + input.mime + ";base64," + base64(safeBytes) };
}

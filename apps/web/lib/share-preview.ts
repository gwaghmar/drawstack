const MAX_SHARE_PREVIEW_DATA_URL_LENGTH = 400_000;
const SHARE_PREVIEW_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedSharePreview = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
};

export function parseSharePreviewDataUrl(value: string | null | undefined): ParsedSharePreview | null {
  if (!value || value.length > MAX_SHARE_PREVIEW_DATA_URL_LENGTH) return null;
  const match = SHARE_PREVIEW_PATTERN.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  return { mime: match[1] as ParsedSharePreview["mime"], base64: match[2] };
}

export function sanitizeSharePreviewDataUrl(value: string | null | undefined): string | null {
  return parseSharePreviewDataUrl(value) ? value! : null;
}

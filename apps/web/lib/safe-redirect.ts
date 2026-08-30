const DEFAULT_REDIRECT = "/app/editor";

export function safeLocalRedirect(value: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://drawxyz.invalid");
    return parsed.origin === "https://drawxyz.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

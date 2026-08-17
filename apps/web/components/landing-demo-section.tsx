"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { freeformToSvg } from "@/lib/diagrams/freeform-svg";
import type { CanvasDocument } from "@/lib/diagrams/freeform-canvas";

const PLACEHOLDERS = [
  "Map the OAuth login flow",
  "90-day startup launch plan",
  "Compare React vs Vue",
];

const INITIAL_DOC: CanvasDocument = {
  version: 1,
  shapes: [
    { id: "browser", type: "rectangle", x: 20, y: 40, width: 150, height: 64, fill: "5", text: { content: "Browser" } },
    { id: "app", type: "rectangle", x: 250, y: 40, width: 150, height: 64, fill: "4", text: { content: "App Server" } },
    { id: "auth", type: "rectangle", x: 480, y: 40, width: 150, height: 64, fill: "3", text: { content: "Auth Server" } },
    { id: "a1", type: "arrow", x: 0, y: 0, start: { shapeId: "browser", anchor: "right" }, end: { shapeId: "app", anchor: "left" }, label: "GET /login" },
    { id: "a2", type: "arrow", x: 0, y: 0, start: { shapeId: "app", anchor: "right" }, end: { shapeId: "auth", anchor: "left" }, label: "redirect" },
    { id: "a3", type: "arrow", x: 0, y: 0, start: { shapeId: "auth", anchor: "top" }, end: { shapeId: "app", anchor: "top" }, label: "auth code", routing: "curved" },
  ],
};

export function LandingDemoSection() {
  const [prompt, setPrompt] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [limited, setLimited] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
  const initialRendered = useRef(false);

  function svgToDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (initialRendered.current) return;
    initialRendered.current = true;
    try {
      setSvgDataUrl(svgToDataUrl(freeformToSvg(INITIAL_DOC)));
    } catch {
      /* ignore initial render failure */
    }
  }, []);

  async function handleGenerate() {
    const text = prompt.trim() || PLACEHOLDERS[placeholderIdx];
    if (!text || loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (res.status === 429) {
        setLimited(true);
        return;
      }

      if (!res.ok) {
        setErrorMsg("Generation failed — please try again.");
        return;
      }

      const data = await res.json() as { diagramType: string; source: string };

      try {
        const doc = JSON.parse(data.source) as CanvasDocument;
        setSvgDataUrl(svgToDataUrl(freeformToSvg(doc)));
        setErrorMsg(null);
      } catch {
        setErrorMsg("Could not render — open in editor to see full output.");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "white", borderTop: "1.5px solid var(--fs-border)", borderBottom: "1.5px solid var(--fs-border)", padding: "72px 40px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", textAlign: "center", marginBottom: 16 }}>
          Try it now — no sign-up required
        </p>
        <h2 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(22px,3.5vw,36px)", fontWeight: 400, textTransform: "uppercase", color: "var(--charcoal)", textAlign: "center", marginBottom: 32, lineHeight: 1.1 }}>
          Describe it. Get a diagram.
        </h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerate(); } }}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            rows={2}
            disabled={loading || limited}
            style={{
              flex: 1, resize: "none", fontFamily: "var(--font-sans-fs)", fontSize: 14,
              border: "1.5px solid var(--fs-border)", borderRadius: 4, padding: "12px 14px",
              color: "var(--charcoal)", background: limited ? "#fafafa" : "white", outline: "none",
            }}
          />
          {limited ? (
            <Link
              href="/login?callbackUrl=/app/editor"
              style={{
                fontFamily: "var(--font-mono-fs)", fontSize: 12, letterSpacing: "0.04em",
                textTransform: "uppercase", background: "var(--charcoal)", color: "white",
                border: "1.5px solid var(--charcoal)", padding: "12px 18px", borderRadius: 4,
                textDecoration: "none", display: "flex", alignItems: "center", whiteSpace: "nowrap",
              }}
            >
              Sign up to keep going →
            </Link>
          ) : (
            <button
              onClick={() => void handleGenerate()}
              disabled={loading}
              style={{
                fontFamily: "var(--font-mono-fs)", fontSize: 12, letterSpacing: "0.04em",
                textTransform: "uppercase", background: "var(--charcoal)", color: "white",
                border: "1.5px solid var(--charcoal)", padding: "12px 18px", borderRadius: 4,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Generating…" : "Generate →"}
            </button>
          )}
        </div>

        <div style={{
          background: "#FAFAFA", border: "1.5px solid var(--fs-border)", borderRadius: 4,
          minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, overflow: "auto",
        }}>
          {svgDataUrl && !errorMsg ? (
            <img
              src={svgDataUrl}
              alt="Generated diagram"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          ) : errorMsg ? (
            <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "#666", margin: 0 }}>
              {errorMsg}
            </p>
          ) : loading ? (
            <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "#999", margin: 0 }}>Generating…</p>
          ) : (
            <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "#999", margin: 0 }}>
              Your diagram will appear here.
            </p>
          )}
        </div>

        {limited && (
          <p style={{ fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "#666", textAlign: "center", marginTop: 16 }}>
            You&apos;ve used your 3 free generations.{" "}
            <Link href="/login?callbackUrl=/app/editor" style={{ color: "var(--fs-indigo)", textDecoration: "none" }}>
              Sign up free
            </Link>{" "}
            for unlimited diagrams.
          </p>
        )}
      </div>
    </div>
  );
}

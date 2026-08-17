"use client";

import { useState } from "react";
import { TEMPLATES } from "@/lib/templates";
import type { TemplateCategory } from "@/lib/templates";
import { DiagramTypeIcon } from "@/components/diagram-icon";
import { forkTemplate } from "@/app/actions/templates";

const FILTERS: { id: TemplateCategory | "all"; label: string }[] = [
  { id: "all",        label: "All" },
  { id: "whiteboard", label: "Free Canvas" },
];

const PREVIEW_BG: Record<string, string> = {
  whiteboard: "#1E1B4B",
};

export function TemplatesClient() {
  const [activeFilter, setActiveFilter] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");

  const visible = TEMPLATES.filter((t) => {
    const matchesFilter = activeFilter === "all" || t.category === activeFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      {/* PAGE HEADER */}
      <div style={{ padding: "48px 40px 32px", borderBottom: "1.5px solid var(--fs-border)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", maxWidth: 1060, margin: "0 auto", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(28px,4vw,40px)", fontWeight: 400, textTransform: "uppercase", color: "var(--charcoal)", marginBottom: 8, lineHeight: 1.1 }}>
              Templates
            </h1>
            <p style={{ fontFamily: "var(--font-sans-fs)", fontSize: 16, color: "var(--charcoal-light)", fontWeight: 300, lineHeight: 1.5 }}>
              Curated starting points. Fork one and start editing — the original stays untouched.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid var(--fs-border)", borderRadius: 2, padding: "7px 12px", background: "white" }}>
            <span style={{ color: "#999", fontSize: 14 }}>⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              style={{ border: "none", outline: "none", fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "var(--charcoal)", background: "transparent", width: 180 }}
            />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ padding: "14px 40px", borderBottom: "1px solid var(--fs-border)", display: "flex", gap: 6, alignItems: "center", overflowX: "auto", background: "var(--cream)" }}>
        <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "#999", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 8, flexShrink: 0 }}>
          Filter
        </span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className="fs-btn-press"
            style={{
              padding: "6px 14px", border: "1.5px solid var(--fs-border)", borderRadius: 2,
              fontFamily: "var(--font-mono-fs)", fontSize: 11, letterSpacing: "0.02em",
              background: activeFilter === f.id ? "var(--charcoal)" : "white",
              color: activeFilter === f.id ? "white" : "var(--charcoal-light)",
              cursor: "pointer", flexShrink: 0, transition: "background 0.12s, color 0.12s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* CARD GRID */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {visible.length === 0 && (
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "#999", gridColumn: "1/-1", textAlign: "center", padding: "40px 0" }}>
            No templates match &ldquo;{search}&rdquo;
          </p>
        )}
        {visible.map((t) => (
          <div
            key={t.id}
            style={{ background: "white", border: "1.5px solid var(--fs-border)", borderRadius: 4, overflow: "hidden", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-3px)"; el.style.boxShadow = "0 10px 32px rgba(0,0,0,0.09)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ""; el.style.boxShadow = ""; }}
          >
            {/* Dark preview area */}
            <div style={{ height: 160, background: PREVIEW_BG[t.category] ?? "#1E1E1E", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, padding: "4px 10px" }}>
                  <DiagramTypeIcon type={t.diagramType} className="h-3 w-3" />
                  <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {t.diagramType}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 1.3 }}>
                  {t.title}
                </span>
              </div>
            </div>
            {/* Card body */}
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 2, background: "var(--fs-indigo-bg)", color: "var(--fs-indigo)" }}>
                  {t.tag}
                </span>
                <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 2, background: "#F3F4F6", color: "#6B7280" }}>
                  {t.diagramType}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, fontWeight: 500, color: "var(--charcoal)", marginBottom: 6 }}>
                {t.title}
              </div>
              <div style={{ fontFamily: "var(--font-sans-fs)", fontSize: 12, color: "var(--charcoal-light)", lineHeight: 1.5, fontWeight: 300, marginBottom: 14 }}>
                {t.description}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "#999", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {t.diagramType}
                </span>
                <form action={forkTemplate.bind(null, t.id)}>
                  <button
                    type="submit"
                    className="fs-btn-press"
                    style={{ background: "var(--charcoal)", color: "white", border: "none", padding: "6px 14px", borderRadius: 2, fontFamily: "var(--font-mono-fs)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    Fork →
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

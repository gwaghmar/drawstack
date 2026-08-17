import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { LandingDemoSection } from "@/components/landing-demo-section";
import { LandingHeader } from "@/components/landing-header";

const DIAGRAM_TYPES = [
  "Flowchart", "Sequence", "ER diagram", "Gantt", "Mindmap",
  "Class diagram", "BPMN", "Cloud arch", "Org chart", "Timeline",
  "Vs. comparison", "2×2 matrix", "Funnel", "Tier list", "Iceberg",
  "Venn", "Excalidraw", "ECharts", "Nivo charts", "Freeform canvas", "Budget", "Bracket",
];

const FEATURED = new Set(["Flowchart", "Sequence", "Cloud arch"]);

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.email);

  const editorHref = isLoggedIn
    ? "/app/editor"
    : "/login?callbackUrl=" + encodeURIComponent("/app/editor");

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* NAV */}
      <LandingHeader isLoggedIn={isLoggedIn} editorHref={editorHref} />

      <main id="main-content" tabIndex={-1}>

        {/* HERO */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "72px 40px 40px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", marginBottom: 24 }}>
            AI Diagram Generator
          </p>
          <h1 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(36px,6vw,64px)", fontWeight: 400, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.05, color: "var(--charcoal)", marginBottom: 24 }}>
            Go from idea to{" "}
            <span style={{ color: "var(--fs-indigo)" }}>diagram</span>
            <br />in seconds.
          </h1>
          <p style={{ fontFamily: "var(--font-sans-fs)", fontSize: 20, fontWeight: 300, lineHeight: 1.6, color: "var(--charcoal-light)", maxWidth: 560, margin: "0 auto 40px" }}>
            Describe what you need. drawxyz picks the right diagram type and generates it instantly — flowcharts, timelines, org charts, and 19 more.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            {isLoggedIn ? (
              <Link
                href="/app/editor"
                className="fs-btn-press"
                style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--charcoal)", color: "#fff", border: "1.5px solid var(--charcoal)", padding: "13px 28px", borderRadius: 2, textDecoration: "none" }}
              >
                Open editor →
              </Link>
            ) : (
              <a
                href="#try-it"
                className="fs-btn-press"
                style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--charcoal)", color: "#fff", border: "1.5px solid var(--charcoal)", padding: "13px 28px", borderRadius: 2, textDecoration: "none" }}
              >
                Try it free →
              </a>
            )}
            <Link
              href="/app/templates"
              className="fs-btn-press"
              style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", background: "transparent", color: "var(--charcoal)", border: "1.5px solid var(--fs-border)", padding: "13px 28px", borderRadius: 2, textDecoration: "none" }}
            >
              Browse templates
            </Link>
          </div>
        </div>

        {/* TRUST STRIP */}
        <div style={{ background: "var(--charcoal)", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Supports</span>
          {["Mermaid", "Excalidraw", "ReactFlow", "ECharts", "BPMN", "Freeform", "+ 16 more"].map((t) => (
            <span key={t} style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "#aaa", letterSpacing: "0.04em" }}>{t}</span>
          ))}
        </div>

        {/* LIVE DEMO */}
        <div id="try-it">
          <LandingDemoSection />
        </div>

        {/* FEATURES */}
        <div style={{ background: "var(--cream)", padding: "56px 40px" }}>
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", textAlign: "center", marginBottom: 16 }}>How it works</p>
          <h2 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 400, textTransform: "uppercase", color: "var(--charcoal)", textAlign: "center", marginBottom: 56, lineHeight: 1.1 }}>
            Three steps to a finished diagram
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, maxWidth: 860, margin: "0 auto" }}>
            {[
              { icon: "✦", title: "AI picks the type", desc: "Describe what you need — AI selects from 22 diagram types and generates clean source instantly." },
              { icon: "⌨", title: "Edit with source or canvas", desc: "Tweak the AI output in the source editor or drag nodes directly. Every change is live-previewed." },
              { icon: "↗", title: "Export anywhere", desc: "PNG, SVG, PDF, or ZIP at any size. Sized for LinkedIn posts, pitch decks, docs, or presentations." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: "white", border: "1.5px solid var(--fs-border)", borderRadius: 4, padding: "28px 24px" }}>
                <div style={{ width: 36, height: 36, background: "var(--fs-indigo-bg)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 18 }}>{icon}</div>
                <div style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, fontWeight: 500, color: "var(--charcoal)", marginBottom: 8 }}>{title}</div>
                <div style={{ fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "var(--charcoal-light)", lineHeight: 1.6, fontWeight: 300 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 22 TYPES CHIP CLOUD */}
        <div style={{ background: "var(--cream-dark)", padding: "56px 40px" }}>
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", textAlign: "center", marginBottom: 16 }}>22 diagram types</p>
          <h2 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 400, textTransform: "uppercase", color: "var(--charcoal)", textAlign: "center", marginBottom: 32, lineHeight: 1.1 }}>
            One tool. Every diagram.
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 760, margin: "0 auto", justifyContent: "center" }}>
            {DIAGRAM_TYPES.map((t) => (
              <span
                key={t}
                style={{
                  border: "1.5px solid var(--fs-border)", borderRadius: 2, padding: "7px 15px",
                  fontFamily: "var(--font-mono-fs)", fontSize: 12, letterSpacing: "0.03em",
                  background: FEATURED.has(t) ? "var(--charcoal)" : "var(--cream)",
                  color: FEATURED.has(t) ? "white" : "var(--charcoal-mid)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* DARK CTA */}
        <div style={{ background: "var(--charcoal)", padding: "56px 40px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 400, textTransform: "uppercase", color: "white", marginBottom: 16, lineHeight: 1.1 }}>
            Start diagramming in 30 seconds.
          </h2>
          <p style={{ fontFamily: "var(--font-sans-fs)", fontSize: 16, color: "#aaa", fontWeight: 300, marginBottom: 36 }}>
            No signup required to try. Open the editor and describe your first diagram.
          </p>
          <Link
            href={editorHref}
            className="fs-btn-press"
            style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", background: "white", color: "var(--charcoal)", border: "1.5px solid white", padding: "13px 28px", borderRadius: 2, textDecoration: "none", display: "inline-block" }}
          >
            Open editor →
          </Link>
        </div>

        {/* FOOTER */}
        <footer style={{ background: "#111", padding: "40px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo className="h-6 w-6 rounded-sm shadow-xs shadow-orange-500/20" />
            <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "#555" }}>drawxyz</span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "Pricing", href: "/pricing" },
              { label: "Docs", href: "/docs" },
              { label: "Privacy", href: "/legal/privacy" },
              { label: "Terms", href: "/legal/terms" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "#555", textDecoration: "none", letterSpacing: "0.04em" }}>{label}</Link>
            ))}
          </div>
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "#444" }}>© 2026 drawxyz</span>
        </footer>
      </main>
    </div>
  );
}

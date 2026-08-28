import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { LandingDemoSection } from "@/components/landing-demo-section";
import { LandingHeader } from "@/components/landing-header";

const CAPABILITIES = [
  "Flowcharts", "Org charts", "Dashboards", "Mindmaps", "Timelines",
  "Treemaps", "Network diagrams", "System architecture", "Financial cards",
  "Process maps", "Icon posters", "Terminal art",
];

const FEATURED = new Set(["Flowcharts", "Dashboards", "Org charts"]);

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.email);

  const editorHref = isLoggedIn
    ? "/app/engine-v2"
    : "/login?callbackUrl=" + encodeURIComponent("/app/engine-v2");

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
            Describe what you need and watch it build itself on one visual canvas — flowcharts, dashboards, timelines, org charts, and more, all live and editable together.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            {isLoggedIn ? (
              <Link
                href="/app/engine-v2"
                className="fs-btn-press"
                style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--charcoal)", color: "#fff", border: "1.5px solid var(--charcoal)", padding: "13px 28px", borderRadius: 2, textDecoration: "none" }}
              >
                Open studio →
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
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>One canvas</span>
          {["Flowcharts", "Dashboards", "Org charts", "Timelines", "Network maps", "System diagrams"].map((t) => (
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
              { icon: "✦", title: "AI builds the document", desc: "Describe the outcome. AI creates editable structure, charts, metrics, and connected graphs." },
              { icon: "⌨", title: "Edit every real node", desc: "Resize, reorder, align, duplicate, and edit content without flattening the result into a picture." },
              { icon: "↗", title: "Export the same result", desc: "Download PNG, SVG, PDF, JSON, or editable React / TSX from the document you reviewed." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: "white", border: "1.5px solid var(--fs-border)", borderRadius: 4, padding: "28px 24px" }}>
                <div style={{ width: 36, height: 36, background: "var(--fs-indigo-bg)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 18 }}>{icon}</div>
                <div style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, fontWeight: 500, color: "var(--charcoal)", marginBottom: 8 }}>{title}</div>
                <div style={{ fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "var(--charcoal-light)", lineHeight: 1.6, fontWeight: 300 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CAPABILITIES CHIP CLOUD */}
        <div style={{ background: "var(--cream-dark)", padding: "56px 40px" }}>
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", textAlign: "center", marginBottom: 16 }}>One canvas, built for AI</p>
          <h2 style={{ fontFamily: "var(--font-mono-fs)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 400, textTransform: "uppercase", color: "var(--charcoal)", textAlign: "center", marginBottom: 32, lineHeight: 1.1 }}>
            One tool. Every diagram.
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 760, margin: "0 auto", justifyContent: "center" }}>
            {CAPABILITIES.map((t) => (
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
            Open studio →
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

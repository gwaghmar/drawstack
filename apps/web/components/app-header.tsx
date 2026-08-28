"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

type Props = {
  creditsLabel: string | null;
  showAdmin: boolean;
  headerIdentity: string | null;
  signOutAction: () => Promise<void>;
};

export function AppHeader({ creditsLabel, showAdmin, headerIdentity, signOutAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        background: "var(--cream)",
        borderBottom: "1.5px solid var(--fs-border)",
        height: 56,
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Desktop + mobile top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", padding: "0 20px" }}>
        {/* Logo */}
        <Link href="/app" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Logo className="h-6 w-6 shadow-xs rounded-sm shadow-orange-500/20" />
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, color: "var(--charcoal)", fontWeight: 500 }}>
            drawxyz
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex" style={{ alignItems: "center", gap: 20 }}>
          <Link href="/app" style={navLinkStyle}>Projects</Link>
          <Link href="/app/engine-v2" style={navLinkStyle}>Studio</Link>
          {creditsLabel && (
            <span style={badgeStyle}>{creditsLabel}</span>
          )}
          {showAdmin && (
            <Link href="/app/admin" style={navLinkStyle}>Admin</Link>
          )}
          <Link href="/app/settings" style={navLinkStyle}>Settings</Link>
          {headerIdentity && (
            <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "#999", letterSpacing: "0.02em" }}>
              {headerIdentity}
            </span>
          )}
          <form action={signOutAction}>
            <button type="submit" style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "var(--charcoal-light)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Sign out
            </button>
          </form>
          <Link href="/app/engine-v2" style={ctaStyle}>New visual →</Link>
        </nav>

        {/* Mobile right side */}
        <div className="flex md:hidden" style={{ alignItems: "center", gap: 10 }}>
          <Link href="/app/engine-v2" style={{ ...ctaStyle, fontSize: 11, padding: "5px 10px" }}>
            New visual →
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "var(--charcoal)" }}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            background: "var(--cream)",
            borderBottom: "1.5px solid var(--fs-border)",
            padding: "12px 20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          {creditsLabel && (
            <span style={{ ...badgeStyle, alignSelf: "flex-start" }}>{creditsLabel}</span>
          )}
          <Link href="/app" onClick={() => setMenuOpen(false)} style={mobileNavLinkStyle}>Projects</Link>
          <Link href="/app/engine-v2" onClick={() => setMenuOpen(false)} style={mobileNavLinkStyle}>Studio</Link>
          {showAdmin && (
            <Link href="/app/admin" onClick={() => setMenuOpen(false)} style={mobileNavLinkStyle}>Admin</Link>
          )}
          <Link href="/app/settings" onClick={() => setMenuOpen(false)} style={mobileNavLinkStyle}>Settings</Link>
          {headerIdentity && (
            <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "#999" }}>
              Signed in as {headerIdentity}
            </span>
          )}
          <form action={signOutAction}>
            <button type="submit" style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal-light)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono-fs)",
  fontSize: 12,
  color: "var(--charcoal-light)",
  textDecoration: "none",
  letterSpacing: "0.01em",
};

const mobileNavLinkStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono-fs)",
  fontSize: 14,
  color: "var(--charcoal)",
  textDecoration: "none",
  letterSpacing: "0.01em",
};

const badgeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono-fs)",
  fontSize: 10,
  letterSpacing: "0.04em",
  background: "var(--fs-indigo-bg)",
  color: "var(--fs-indigo)",
  padding: "3px 10px",
  borderRadius: 2,
  border: "1px solid var(--fs-indigo-border)",
};

const ctaStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono-fs)",
  fontSize: 12,
  letterSpacing: "0.04em",
  background: "var(--charcoal)",
  color: "#fff",
  padding: "6px 14px",
  borderRadius: 2,
  textDecoration: "none",
};

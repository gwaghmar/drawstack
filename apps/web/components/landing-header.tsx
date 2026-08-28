"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

type Props = {
  isLoggedIn: boolean;
  editorHref: string;
};

export function LandingHeader({ isLoggedIn, editorHref }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        background: "var(--cream)",
        borderBottom: "1.5px solid var(--fs-border)",
        height: 64,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", padding: "0 24px" }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo className="h-7 w-7 rounded-sm shadow-xs shadow-orange-500/20" />
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 15, color: "var(--charcoal)", fontWeight: 500 }}>drawxyz</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex" style={{ alignItems: "center", gap: 28 }}>
          {["Pricing", "Docs", "Templates"].map((label) => (
            <Link key={label} href={label === "Templates" ? "/app/templates" : `/${label.toLowerCase()}`} style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal-light)", textDecoration: "none", letterSpacing: "0.01em" }}>
              {label}
            </Link>
          ))}
          {isLoggedIn ? (
            <Link href="/app" style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal-light)", textDecoration: "none" }}>
              My projects
            </Link>
          ) : (
            <Link href="/login" style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal-light)", textDecoration: "none" }}>
              Sign in
            </Link>
          )}
          <Link
            href={editorHref}
            className="fs-btn-press"
            style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.04em", background: "var(--charcoal)", color: "#fff", padding: "8px 18px", borderRadius: 2, textDecoration: "none", display: "inline-block" }}
          >
            Open studio →
          </Link>
        </nav>

        {/* Mobile right side */}
        <div className="flex sm:hidden" style={{ alignItems: "center", gap: 8 }}>
          <Link
            href={editorHref}
            style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, letterSpacing: "0.04em", background: "var(--charcoal)", color: "#fff", padding: "6px 12px", borderRadius: 2, textDecoration: "none" }}
          >
            Open studio →
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
          className="sm:hidden"
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            background: "var(--cream)",
            borderBottom: "1.5px solid var(--fs-border)",
            padding: "12px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          {["Pricing", "Docs", "Templates"].map((label) => (
            <Link
              key={label}
              href={label === "Templates" ? "/app/templates" : `/${label.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, color: "var(--charcoal)", textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
          {isLoggedIn ? (
            <Link href="/app" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, color: "var(--charcoal)", textDecoration: "none" }}>
              My projects
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--font-mono-fs)", fontSize: 14, color: "var(--charcoal)", textDecoration: "none" }}>
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

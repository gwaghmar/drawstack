"use client";

import Link from "next/link";
import { useState } from "react";

const editorSignInHref =
  "/login?callbackUrl=" + encodeURIComponent("/app/editor");

const focusRing =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export default function PricingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen dot-grid-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <header className="relative z-50 border-b border-slate-200 bg-[var(--cream,#faf9f7)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className={`text-lg font-semibold tracking-tight text-slate-900 ${focusRing} rounded-xs`}
          >
            drawxyz
          </Link>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-x-6 text-sm text-slate-600">
            <Link href="/pricing" className={`rounded-xs font-medium text-slate-900 ${focusRing}`} aria-current="page">Pricing</Link>
            <Link href="/docs" className={`rounded-xs hover:text-slate-900 ${focusRing}`}>Docs</Link>
            <Link href="/legal/privacy" className={`rounded-xs hover:text-slate-900 ${focusRing}`}>Privacy</Link>
            <Link href="/login" className={`rounded-xs font-medium text-indigo-600 hover:text-indigo-800 ${focusRing}`}>Sign in</Link>
          </nav>
          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-1 text-slate-700"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 3l14 14M17 3L3 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            )}
          </button>
        </div>
        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-[var(--cream,#faf9f7)] px-6 py-4 flex flex-col gap-4 text-sm shadow-md">
            <Link href="/pricing" onClick={() => setMenuOpen(false)} className="font-medium text-slate-900">Pricing</Link>
            <Link href="/docs" onClick={() => setMenuOpen(false)} className="text-slate-600">Docs</Link>
            <Link href="/legal/privacy" onClick={() => setMenuOpen(false)} className="text-slate-600">Privacy</Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="font-medium text-indigo-600">Sign in</Link>
          </div>
        )}
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-5xl px-6 pb-24 pt-4"
        tabIndex={-1}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Pricing
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          Free to test while we finish the hosted plan experience. Paid checkout is not open yet.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <section
            aria-labelledby="plan-free"
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-xs"
          >
            <h2 id="plan-free" className="text-lg font-semibold text-slate-900">
              Free
            </h2>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
              $0
            </p>
            <p className="mt-1 text-sm text-slate-500">Free forever</p>

            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm leading-relaxed text-slate-600">
              <li>5 free AI diagram generations to start</li>
              <li>12+ themes, social presets for every network</li>
              <li>PNG and SVG export in your browser</li>
              <li>REST API and MCP with free-tier rate limits</li>
            </ul>
            <Link
              href={editorSignInHref}
              className={`mt-8 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 ${focusRing} ring-offset-white`}
            >
              Open the editor
            </Link>
          </section>

          <section
            aria-labelledby="plan-pro"
            className="flex flex-col rounded-2xl border-2 border-indigo-500 bg-white p-8 shadow-md ring-1 ring-indigo-500/10"
          >
            <h2 id="plan-pro" className="text-lg font-semibold text-indigo-950">
              Pro <span className="ml-2 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">Coming soon</span>
            </h2>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-indigo-950">
              Not available yet
            </p>
            <p className="mt-1 text-sm text-indigo-900/80">
              We are validating the complete product before opening paid plans.
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm leading-relaxed text-indigo-950/85">
              <li>No watermark on exports</li>
              <li>Download as PDF · Batch export multiple diagrams</li>
              <li>Unlimited AI diagram generations</li>
              <li>Priority API access</li>
              <li>Brand kit and logo frame</li>
            </ul>
            <Link
              href={editorSignInHref}
              className={`mt-8 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 ${focusRing} ring-offset-white`}
            >
              Test the editor
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">
              No payment details required.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

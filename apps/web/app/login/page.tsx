import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithPassword, signUpWithPassword } from "@/app/actions/login";
import { isMockAuthEnabled } from "@/lib/auth-mode";
import { Logo } from "@/components/logo";
import { PasskeyAuth } from "@/components/passkey-auth";
import { safeLocalRedirect } from "@/lib/safe-redirect";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  sign_in_failed: "Sign in failed. Please try again.",
  already_registered: "An account with this email already exists. Sign in instead.",
  sign_up_failed: "Could not create account. Please try again.",
  auth_callback_failed: "Sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const cb = safeLocalRedirect(sp.callbackUrl);
  const isSignUp = sp.mode === "signup";
  const errorMsg = sp.error ? (ERROR_MESSAGES[sp.error] ?? "Something went wrong. Please try again.") : null;
  const isMock = isMockAuthEnabled();

  const inputStyle = {
    width: "100%",
    background: "#fff",
    border: "1.5px solid var(--fs-border)",
    borderRadius: 2,
    padding: "10px 12px",
    fontFamily: "var(--font-sans-fs)",
    fontSize: 14,
    color: "var(--charcoal)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontFamily: "var(--font-mono-fs)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--charcoal-light)",
    marginBottom: 6,
  };

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      {/* NAV */}
      <header style={{ maxWidth: 960, margin: "0 auto", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Logo className="h-6 w-6" />
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal)", fontWeight: 500 }}>
            drawxyz
          </span>
        </Link>
        <Link
          href="/"
          style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal-light)", textDecoration: "none" }}
        >
          Back to home
        </Link>
      </header>

      {/* CARD */}
      <div style={{ maxWidth: 400, margin: "48px auto 0", padding: "0 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fs-indigo)", marginBottom: 12 }}>
            drawxyz
          </p>
          <h1 style={{ fontFamily: "var(--font-mono-fs)", fontSize: 28, fontWeight: 400, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--charcoal)", margin: 0 }}>
            {isSignUp ? "Create account" : "Welcome back"}
          </h1>
        </div>

        <div style={{ background: "#fff", border: "1.5px solid var(--fs-border)", borderRadius: 4, padding: 28 }}>

          {/* Tab switcher */}
          <div style={{ display: "flex", border: "1.5px solid var(--fs-border)", borderRadius: 2, overflow: "hidden", marginBottom: 24 }}>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(cb)}`}
              style={{
                flex: 1,
                padding: "8px 0",
                textAlign: "center",
                fontFamily: "var(--font-mono-fs)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                background: !isSignUp ? "var(--charcoal)" : "transparent",
                color: !isSignUp ? "#fff" : "var(--charcoal-light)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Sign in
            </Link>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(cb)}&mode=signup`}
              style={{
                flex: 1,
                padding: "8px 0",
                textAlign: "center",
                fontFamily: "var(--font-mono-fs)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                background: isSignUp ? "var(--charcoal)" : "transparent",
                color: isSignUp ? "#fff" : "var(--charcoal-light)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Create account
            </Link>
          </div>

          {/* Dev mock sign-in */}
          {isMock && (
            <form
              action={async (formData: FormData) => {
                "use server";
                const email = (formData.get("email") as string | null)?.trim() || "dev@example.com";
                void email;
                redirect(cb);
              }}
              style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <input
                name="email"
                type="email"
                placeholder="dev@example.com"
                style={inputStyle}
              />
              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 2,
                  padding: "10px 0",
                  fontFamily: "var(--font-mono-fs)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Demo sign-in
              </button>
              <p style={{ textAlign: "center", fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.06em", color: "var(--charcoal-light)" }}>
                Dev mode — no password required
              </p>
            </form>
          )}

          {/* Error */}
          {errorMsg && (
            <p style={{
              marginBottom: 20,
              border: "1.5px solid #fca5a5",
              background: "#fef2f2",
              borderRadius: 2,
              padding: "10px 12px",
              fontFamily: "var(--font-sans-fs)",
              fontSize: 13,
              color: "#991b1b",
            }}>
              {errorMsg}
            </p>
          )}

          {/* Sign up form */}
          {isSignUp ? (
            <form
              action={async (formData: FormData) => {
                "use server";
                const email = (formData.get("email") as string)?.trim();
                const password = formData.get("password") as string;
                const base = `/login?callbackUrl=${encodeURIComponent(cb)}&mode=signup`;
                const err = await signUpWithPassword(email, password, cb);
                if (err) {
                  const { redirect } = await import("next/navigation");
                  redirect(`${base}&error=${err}`);
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label htmlFor="signup-email" style={labelStyle}>Email</label>
                <input id="signup-email" name="email" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="signup-password" style={labelStyle}>Password</label>
                <input id="signup-password" name="password" type="password" required minLength={8} autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                className="fs-btn-press"
                style={{
                  width: "100%",
                  background: "var(--charcoal)",
                  color: "#fff",
                  border: "1.5px solid var(--charcoal)",
                  borderRadius: 2,
                  padding: "11px 0",
                  fontFamily: "var(--font-mono-fs)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Create account →
              </button>
            </form>
          ) : (
            <>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const email = (formData.get("email") as string)?.trim();
                  const password = formData.get("password") as string;
                  const base = `/login?callbackUrl=${encodeURIComponent(cb)}`;
                  const err = await signInWithPassword(email, password, cb);
                  if (err) {
                    const { redirect } = await import("next/navigation");
                    redirect(`${base}&error=${err}`);
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <label htmlFor="login-email" style={labelStyle}>Email</label>
                  <input id="login-email" name="email" type="email" required autoComplete="email"
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="login-password" style={labelStyle}>Password</label>
                  <input id="login-password" name="password" type="password" required autoComplete="current-password"
                    placeholder="Your password"
                    style={inputStyle}
                  />
                </div>
                <button
                  type="submit"
                  className="fs-btn-press"
                  style={{
                    width: "100%",
                    background: "var(--charcoal)",
                    color: "#fff",
                    border: "1.5px solid var(--charcoal)",
                    borderRadius: 2,
                    padding: "11px 0",
                    fontFamily: "var(--font-mono-fs)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Sign in →
                </button>

                <Link
                  href="/auth/forgot-password"
                  style={{ textAlign: "center", fontFamily: "var(--font-sans-fs)", fontSize: 12, color: "var(--fs-indigo)", textDecoration: "none" }}
                >
                  Forgot password?
                </Link>
              </form>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--fs-border)" }} />
                <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "var(--charcoal-light)" }}>
                  OR
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--fs-border)" }} />
              </div>

              {/* Passkey auth */}
              <PasskeyAuth
                email={undefined}
                mode="signin"
                callbackUrl={cb}
              />
            </>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontFamily: "var(--font-sans-fs)", fontSize: 12, color: "var(--charcoal-light)" }}>
          By signing in you agree to our{" "}
          <Link href="/legal/terms" style={{ color: "var(--charcoal)", textDecoration: "underline" }}>Terms</Link>
          {" "}and{" "}
          <Link href="/legal/privacy" style={{ color: "var(--charcoal)", textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

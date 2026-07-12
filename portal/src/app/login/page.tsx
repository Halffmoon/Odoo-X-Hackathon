"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Invalid email or password.");
        else if (err.status === 403) setError("Account is locked or inactive.");
        else setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      {/* form side */}
      <div className="flex items-center justify-center px-5 py-16 sm:px-10">
        <div className="fade-up w-full max-w-sm">
          <Link href="/" className="eyebrow mb-10 inline-flex no-underline">
            ← AssetFlow
          </Link>

          <h1 className="text-[30px] font-extrabold leading-tight">Welcome back.</h1>
          <p className="mt-2 text-[14.5px] text-text-soft">
            Log in to see what your organization holds today.
          </p>

          {error && (
            <div className="mt-6 rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[color:var(--hue-coral)]">
              {error}
            </div>
          )}

          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Work email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span className="flex items-center justify-between">
                Password
                <a href="#" className="text-xs font-normal text-text-soft hover:text-accent">
                  Forgot password?
                </a>
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-accent btn-lg mt-2 justify-center disabled:opacity-60"
            >
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[13.5px] text-text-soft">
            New to AssetFlow?{" "}
            <Link href="/signup" className="font-semibold text-accent no-underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* brand side */}
      <div className="relative hidden overflow-hidden border-l border-line bg-paper-raised lg:block">
        <div
          className="hero-blob"
          style={{ inset: "10% -10% auto auto", opacity: 0.6 }}
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-center gap-8 px-14">
          <div className="dash fade-up" style={{ ["--d" as string]: "0.1s" }}>
            <div className="dash-bar">
              <span className="dash-dot" />
              <span className="dash-dot" />
              <span className="dash-dot" />
              <span className="dash-title">dashboard · overview</span>
            </div>
            <div className="dash-body">
              <div className="dash-kpis">
                <div className="dash-kpi">
                  <div className="n" style={{ color: "var(--hue-teal)" }}>
                    128
                  </div>
                  <div className="l">Available</div>
                </div>
                <div className="dash-kpi">
                  <div className="n" style={{ color: "var(--hue-amber)" }}>
                    342
                  </div>
                  <div className="l">Allocated</div>
                </div>
                <div className="dash-kpi">
                  <div className="n" style={{ color: "var(--hue-coral)" }}>
                    6
                  </div>
                  <div className="l">Maint. today</div>
                </div>
              </div>
              <div className="dash-table">
                <div className="dash-row head">
                  <span>Asset</span>
                  <span>Holder</span>
                  <span>Status</span>
                </div>
                <div className="dash-row">
                  <span className="tag">AF-0114 · Laptop</span>
                  <span>Priya Nair</span>
                  <span className="chip chip-allocated">Allocated</span>
                </div>
                <div className="dash-row">
                  <span className="tag">AF-0037 · Projector</span>
                  <span>Unassigned</span>
                  <span className="chip chip-available">Available</span>
                </div>
              </div>
            </div>
          </div>
          <blockquote className="fade-up max-w-sm text-[14.5px] leading-relaxed text-text-soft" style={{ ["--d" as string]: "0.2s" }}>
            “Every asset, every booking, every approval — one login, in real time.”
          </blockquote>
        </div>
      </div>
    </main>
  );
}

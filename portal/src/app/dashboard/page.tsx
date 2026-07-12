"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import AppShell from "@/components/AppShell";
import Reveal from "@/components/Reveal";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { dashboardApi } from "@/lib/api/dashboard";
import { employeesApi } from "@/lib/api/employees";

const HUES = {
  teal: { c: "var(--hue-teal)", s: "var(--hue-teal-soft)" },
  amber: { c: "var(--hue-amber)", s: "var(--hue-amber-soft)" },
  coral: { c: "var(--hue-coral)", s: "var(--hue-coral-soft)" },
  blue: { c: "var(--hue-blue)", s: "var(--hue-blue-soft)" },
  violet: { c: "var(--hue-violet)", s: "var(--hue-violet-soft)" },
  lime: { c: "var(--hue-lime)", s: "var(--hue-lime-soft)" },
} as const;

type Hue = keyof typeof HUES;

const ICON: Record<string, React.ReactNode> = {
  box: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.6L8 2L14 4.6V11.4L8 14L2 11.4V4.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 4.6L8 7.2M8 7.2L14 4.6M8 7.2V14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  swap: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5H12.5L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10.5H3.5L6 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wrench: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M10.6 2.2a3.2 3.2 0 0 0-4.2 3.9L2 10.5l1.9 1.9 4.4-4.4a3.2 3.2 0 0 0 3.9-4.2l-2.2 2.2-1.7-1.7 2.2-2.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.3H14.5M4.5 1.5V4M11.5 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  arrows: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M5 2L2 5L5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 5H10.5C12.4 5 14 6.6 14 8.5S12.4 12 10.5 12H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8V8L10.2 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const { user } = useAuth();

  const kpiState = useApi((signal) => dashboardApi.kpis(signal));
  const overdueState = useApi((signal) => dashboardApi.overdue(signal));
  const employeesState = useApi((signal) => employeesApi.list(undefined, signal));

  const { refetch: refetchKpis } = kpiState;
  const { refetch: refetchOverdue } = overdueState;
  useEffect(() => {
    const id = setInterval(() => {
      refetchKpis();
      refetchOverdue();
    }, 30_000);
    return () => clearInterval(id);
  }, [refetchKpis, refetchOverdue]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (employeesState.data ?? []).forEach((e) => map.set(e.employee_id, e.name));
    return map;
  }, [employeesState.data]);

  const kpis = kpiState.data;
  const KPIS: { label: string; value: number; hue: Hue; icon: string }[] = kpis
    ? [
        { label: "Assets available", value: kpis.assets_available, hue: "teal", icon: "box" },
        { label: "Assets allocated", value: kpis.assets_allocated, hue: "amber", icon: "swap" },
        { label: "Maintenance today", value: kpis.maintenance_today, hue: "coral", icon: "wrench" },
        { label: "Active bookings", value: kpis.active_bookings, hue: "blue", icon: "calendar" },
        { label: "Pending transfers", value: kpis.pending_transfers, hue: "violet", icon: "arrows" },
        { label: "Upcoming returns", value: kpis.upcoming_returns.length, hue: "lime", icon: "clock" },
      ]
    : [];

  const overdue = overdueState.data ?? [];
  const upcoming = kpis?.upcoming_returns ?? [];
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <AppShell>
      <div>
        <span className="eyebrow">Dashboard</span>
        <h1 className="mt-2 text-[26px] sm:text-[30px]">Welcome back, {firstName}.</h1>
        <p className="mt-1.5 text-[14px] text-text-soft">Here&apos;s what&apos;s moving across the organization today.</p>
      </div>

      <div className="dash-actions">
        <Link href="/assets/register" className="qa-btn primary">+ Register Asset</Link>
        <Link href="/bookings/new" className="qa-btn">Book Resource</Link>
        <Link href="/maintenance/new" className="qa-btn">Raise Maintenance Request</Link>
      </div>

      <Reveal>
        {kpiState.error ? (
          <div className="panel"><div className="empty-state">{kpiState.error} <button className="underline" onClick={kpiState.refetch}>Retry</button></div></div>
        ) : (
          <div className="kpi-card-grid">
            {(kpiState.loading ? Array.from({ length: 6 }) : KPIS).map((k, i) => {
              const kpi = k as { label: string; value: number; hue: Hue; icon: string } | undefined;
              const hue = kpi ? HUES[kpi.hue] : HUES.teal;
              return (
                <div key={kpi?.label ?? i} className="kpi-card" style={{ ["--k-color" as string]: hue.c, ["--k-soft" as string]: hue.s }}>
                  <span className="kicon">{kpi ? ICON[kpi.icon] : null}</span>
                  <div className="knum">{kpi ? kpi.value : "—"}</div>
                  <div className="klabel">{kpi ? kpi.label : "Loading…"}</div>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal style={{ transitionDelay: "120ms" }}>
        <div className="mt-8">
          <div className="section-head">
            <h2 style={{ color: "var(--hue-coral)" }}>Overdue returns</h2>
            <span className="count">{overdue.length} past expected return date</span>
          </div>
          <div className="panel panel-warn">
            <div className="list-row" style={{ background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              <span>Asset</span>
              <span>Holder</span>
              <span>Due date</span>
              <span>Status</span>
            </div>
            {overdueState.loading ? (
              <div className="list-row"><span className="muted">Loading…</span></div>
            ) : overdue.length === 0 ? (
              <div className="list-row"><span className="muted">No overdue returns.</span></div>
            ) : (
              overdue.map((o) => (
                <div key={o.allocation_id} className="list-row">
                  <span className="tag">{o.asset_tag} · {o.asset_name}</span>
                  <span>{o.employee_id ? nameById.get(o.employee_id) ?? "—" : "Department"}</span>
                  <span className="muted">{formatDate(o.expected_return_date)}</span>
                  <span className="chip chip-overdue">{o.days_overdue}d overdue</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Reveal>

      <Reveal style={{ transitionDelay: "160ms" }}>
        <div className="mt-8 lower-grid">
          <div>
            <div className="section-head">
              <h2>Upcoming returns</h2>
              <span className="count">next 7 days</span>
            </div>
            <div className="panel">
              {kpiState.loading ? (
                <div className="list-row"><span className="muted">Loading…</span></div>
              ) : upcoming.length === 0 ? (
                <div className="list-row"><span className="muted">Nothing due in the next 7 days.</span></div>
              ) : (
                upcoming.map((u) => (
                  <div key={u.allocation_id} className="list-row" style={{ gridTemplateColumns: "1.6fr 1fr auto" }}>
                    <span className="tag">{u.asset_tag} · {u.asset_name}</span>
                    <span className="muted">{u.employee_id ? nameById.get(u.employee_id) ?? "—" : "—"}</span>
                    <span className="muted">{formatDate(u.expected_return_date)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>At a glance</h2>
              <span className="count">{kpis?.scope.toLowerCase() ?? ""} scope</span>
            </div>
            <div className="panel">
              <div className="activity-item"><span className="adot" style={{ ["--a-color" as string]: HUES.coral.c }} /><span className="flex-1">{kpis?.overdue_returns ?? 0} allocations overdue for return</span></div>
              <div className="activity-item"><span className="adot" style={{ ["--a-color" as string]: HUES.violet.c }} /><span className="flex-1">{kpis?.pending_transfers ?? 0} transfer requests awaiting approval</span></div>
              <div className="activity-item"><span className="adot" style={{ ["--a-color" as string]: HUES.coral.c }} /><span className="flex-1">{kpis?.maintenance_today ?? 0} assets in maintenance today</span></div>
              <div className="activity-item"><span className="adot" style={{ ["--a-color" as string]: HUES.blue.c }} /><span className="flex-1">{kpis?.active_bookings ?? 0} active resource bookings</span></div>
            </div>
          </div>
        </div>
      </Reveal>
    </AppShell>
  );
}

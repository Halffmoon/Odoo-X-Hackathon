import Link from "next/link";
import AppShell from "@/components/AppShell";
import Reveal from "@/components/Reveal";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const HUES = {
  teal: { c: "var(--hue-teal)", s: "var(--hue-teal-soft)" },
  amber: { c: "var(--hue-amber)", s: "var(--hue-amber-soft)" },
  coral: { c: "var(--hue-coral)", s: "var(--hue-coral-soft)" },
  blue: { c: "var(--hue-blue)", s: "var(--hue-blue-soft)" },
  violet: { c: "var(--hue-violet)", s: "var(--hue-violet-soft)" },
  lime: { c: "var(--hue-lime)", s: "var(--hue-lime-soft)" },
} as const;

const KPIS = [
  { label: "Assets available", value: 128, hue: "teal", icon: "box" },
  { label: "Assets allocated", value: 342, hue: "amber", icon: "swap" },
  { label: "Maintenance today", value: 6, hue: "coral", icon: "wrench" },
  { label: "Active bookings", value: 19, hue: "blue", icon: "calendar" },
  { label: "Pending transfers", value: 4, hue: "violet", icon: "arrows" },
  { label: "Upcoming returns", value: 11, hue: "lime", icon: "clock" },
] as const;

const OVERDUE = [
  { tag: "AF-0114", name: "Dell Latitude 5440", holder: "Priya Nair", due: "3 Jul", days: 9 },
  { tag: "AF-0056", name: "Canon Projector EX40", holder: "Sales Dept.", due: "6 Jul", days: 6 },
  { tag: "AF-0201", name: "Ergo Chair — Type B", holder: "Rohan Iyer", due: "9 Jul", days: 3 },
];

const UPCOMING = [
  { tag: "AF-0092", name: "Room B2 — Booking", holder: "Design Team", due: "14 Jul" },
  { tag: "AF-0140", name: "MacBook Pro 14\"", holder: "Sana Qureshi", due: "16 Jul" },
  { tag: "AF-0075", name: "Bajaj Pulsar (Fleet)", holder: "Logistics", due: "19 Jul" },
];

const QUICK_ACTIONS = [
  {
    href: "/assets/register",
    title: "Register Asset",
    desc: "Add a new asset to the directory",
    hue: "teal",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M2 4.6L8 2L14 4.6V11.4L8 14L2 11.4V4.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M2 4.6L8 7.2M8 7.2L14 4.6M8 7.2V14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/bookings/new",
    title: "Book Resource",
    desc: "Reserve a room, vehicle, or equipment",
    hue: "blue",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.5 6.3H14.5M4.5 1.5V4M11.5 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/maintenance/new",
    title: "Raise Maintenance Request",
    desc: "Report a fault and route it for approval",
    hue: "coral",
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path
          d="M10.6 2.2a3.2 3.2 0 0 0-4.2 3.9L2 10.5l1.9 1.9 4.4-4.4a3.2 3.2 0 0 0 3.9-4.2l-2.2 2.2-1.7-1.7 2.2-2.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

const CHART_ORDER = ["teal", "amber", "violet", "coral", "lime", "blue"] as const;
const CHART_DATA = CHART_ORDER.map((hue) => KPIS.find((k) => k.hue === hue)!);
const CHART_TOTAL = CHART_DATA.reduce((sum, k) => sum + k.value, 0);
const CHART_GRADIENT = (() => {
  let acc = 0;
  const stops = CHART_DATA.map((k) => {
    const from = acc;
    acc += (k.value / CHART_TOTAL) * 100;
    return `${HUES[k.hue].c} ${from}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
})();

const ACTIVITY = [
  { text: "Transfer of AF-0114 approved by Asset Manager", time: "10m ago", hue: "teal" },
  { text: "Booking confirmed — Room B2, 9:00–10:00", time: "42m ago", hue: "blue" },
  { text: "Maintenance request raised for AF-0056", time: "1h ago", hue: "coral" },
  { text: "Audit cycle Q3-West flagged 2 discrepancies", time: "3h ago", hue: "violet" },
  { text: "AF-0037 marked Available after return", time: "5h ago", hue: "lime" },
] as const;

export default function DashboardPage() {
  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Welcome back, {CURRENT_USER.name.split(" ")[0]}.</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Here&apos;s what&apos;s moving across the organization today.</p>
        </div>
      </div>

      <div className="dash-top-row">
        <Reveal>
          <div className="qa-card-grid qa-card-grid-stack">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="qa-card" style={{ ["--q-color" as string]: HUES[a.hue].c, ["--q-soft" as string]: HUES[a.hue].s }}>
                <span className="qicon">{a.icon}</span>
                <span>
                  <span className="qtitle block">{a.title}</span>
                  <span className="qdesc block">{a.desc}</span>
                </span>
                <span className="qarrow">→</span>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal style={{ transitionDelay: "80ms" }}>
          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <h2>Operational split</h2>
                <p>All 6 KPI signals, today</p>
              </div>
              <span className="chart-pill">Live</span>
            </div>
            <div className="donut-wrap">
              <div className="donut" style={{ background: CHART_GRADIENT }}>
                <div className="donut-center">
                  <span className="dn">{CHART_TOTAL}</span>
                  <span className="dl">tracked items</span>
                </div>
              </div>
            </div>
            <div className="chart-legend">
              {CHART_DATA.map((k) => (
                <div key={k.label} className="chart-legend-row">
                  <span className="ldot" style={{ ["--l-color" as string]: HUES[k.hue].c }} />
                  <span className="lname">{k.label}</span>
                  <span className="lval">{k.value}</span>
                  <span className="lpct">{Math.round((k.value / CHART_TOTAL) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal style={{ transitionDelay: "120ms" }}>
        <div className="mt-8">
          <div className="section-head">
            <h2 style={{ color: "var(--hue-coral)" }}>Overdue returns</h2>
            <span className="count">{OVERDUE.length} past expected return date</span>
          </div>
          <div className="panel panel-warn">
            <div className="list-row" style={{ background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              <span>Asset</span>
              <span>Holder</span>
              <span>Due date</span>
              <span>Status</span>
            </div>
            {OVERDUE.map((o) => (
              <div key={o.tag} className="list-row">
                <span className="tag">
                  {o.tag} · {o.name}
                </span>
                <span>{o.holder}</span>
                <span className="muted">{o.due}</span>
                <span className="chip chip-overdue">{o.days}d overdue</span>
              </div>
            ))}
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
              {UPCOMING.map((u) => (
                <div key={u.tag} className="list-row" style={{ gridTemplateColumns: "1.6fr 1fr auto" }}>
                  <span className="tag">
                    {u.tag} · {u.name}
                  </span>
                  <span className="muted">{u.holder}</span>
                  <span className="muted">{u.due}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>Recent activity</h2>
              <span className="count">live</span>
            </div>
            <div className="panel">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="activity-item">
                  <span className="adot" style={{ ["--a-color" as string]: HUES[a.hue].c }} />
                  <span className="flex-1">{a.text}</span>
                  <span className="atime">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </AppShell>
  );
}

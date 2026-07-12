import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const CATEGORIES = ["Electronics", "Furniture", "Vehicles", "Equipment", "Real Estate"];
const CONDITIONS = ["New", "Good", "Fair", "Needs Repair"];

const LIVE_COUNTS = [
  { label: "Assets available", value: 128, hue: "teal", icon: "box" },
  { label: "Assets allocated", value: 342, hue: "amber", icon: "swap" },
  { label: "Maintenance today", value: 6, hue: "coral", icon: "wrench" },
  { label: "Active bookings", value: 19, hue: "blue", icon: "calendar" },
  { label: "Pending transfers", value: 4, hue: "violet", icon: "arrows" },
  { label: "Upcoming returns", value: 11, hue: "lime", icon: "clock" },
] as const;

const HUES: Record<string, { c: string; s: string }> = {
  teal: { c: "var(--hue-teal)", s: "var(--hue-teal-soft)" },
  amber: { c: "var(--hue-amber)", s: "var(--hue-amber-soft)" },
  coral: { c: "var(--hue-coral)", s: "var(--hue-coral-soft)" },
  blue: { c: "var(--hue-blue)", s: "var(--hue-blue-soft)" },
  violet: { c: "var(--hue-violet)", s: "var(--hue-violet-soft)" },
  lime: { c: "var(--hue-lime)", s: "var(--hue-lime-soft)" },
};

const MINI_ICON: Record<string, React.ReactNode> = {
  box: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.6L8 2L14 4.6V11.4L8 14L2 11.4V4.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2 4.6L8 7.2M8 7.2L14 4.6M8 7.2V14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  swap: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5H12.5L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10.5H3.5L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wrench: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path
        d="M10.6 2.2a3.2 3.2 0 0 0-4.2 3.9L2 10.5l1.9 1.9 4.4-4.4a3.2 3.2 0 0 0 3.9-4.2l-2.2 2.2-1.7-1.7 2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M1.5 6.3H14.5M4.5 1.5V4M11.5 1.5V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  arrows: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M5 2L2 5L5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 5H10.5C12.4 5 14 6.6 14 8.5S12.4 12 10.5 12H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.8V8L10.2 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function RegisterAssetPage() {
  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      <Link href="/dashboard" className="eyebrow no-underline">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[30px]">Register Asset</h1>
          <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
            Add a new asset to the directory. It enters the system as <strong className="text-verify">Available</strong> and gets an
            auto-generated tag.
          </p>
        </div>
        <span className="tag rounded-[2px] border border-line bg-paper-raised px-3 py-1.5 font-mono text-[12.5px] text-muted">
          Next tag: <strong className="text-text">AF-0248</strong>
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
      <form className="grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
          Asset name
          <input
            type="text"
            placeholder="e.g. Dell Latitude 5440"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Category
          <select className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Condition
          <select className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]">
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Serial number
          <input
            type="text"
            placeholder="SN-88213-A"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Location
          <input
            type="text"
            placeholder="e.g. Bengaluru HQ, 3rd floor"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Acquisition date
          <input
            type="date"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Acquisition cost
          <input
            type="number"
            placeholder="₹ 0.00"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
          <span className="text-[11px] font-normal text-muted">For ranking/reports only — not linked to accounting.</span>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
          Photo / documents
          <input
            type="file"
            multiple
            className="rounded-[2px] border border-dashed border-line bg-paper-raised px-3.5 py-4 text-[13px] text-text-soft outline-none file:mr-3 file:rounded-[2px] file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-paper"
          />
        </label>

        <label className="flex items-center gap-2.5 rounded-[2px] border border-line bg-paper-raised px-3.5 py-3 text-[13.5px] font-medium sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" />
          Shared / bookable resource
          <span className="font-normal text-muted">— employees can book this by time slot instead of it being allocated to one person.</span>
        </label>

        <div className="mt-2 flex gap-3 sm:col-span-2">
          <button type="submit" className="btn btn-accent btn-lg">
            Register asset
          </button>
          <Link href="/dashboard" className="btn btn-ghost btn-lg">
            Cancel
          </Link>
        </div>
      </form>

      <aside>
        <div className="section-head">
          <h2>Live counts</h2>
          <span className="count">org-wide</span>
        </div>
        <div className="kpi-mini-list">
          {LIVE_COUNTS.map((k) => (
            <div key={k.label} className="kpi-mini-row" style={{ ["--m-color" as string]: HUES[k.hue].c, ["--m-soft" as string]: HUES[k.hue].s }}>
              <span className="micon">{MINI_ICON[k.icon]}</span>
              <span className="mlbl">{k.label}</span>
              <span className="mval">{k.value}</span>
            </div>
          ))}
        </div>
      </aside>
      </div>
    </AppShell>
  );
}

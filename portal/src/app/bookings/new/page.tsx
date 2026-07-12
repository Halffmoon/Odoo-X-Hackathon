import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const RESOURCES = ["Room B2 — Conference", "Room A1 — Huddle", "Projector — Cart 3", "Fleet Vehicle — KA01 AB 4521"];

const EXISTING_BOOKINGS = [
  { slot: "09:00 – 10:00", by: "Design Team", status: "Confirmed" },
  { slot: "13:00 – 14:30", by: "Priya Nair", status: "Confirmed" },
];

export default function BookResourcePage() {
  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      <Link href="/dashboard" className="eyebrow no-underline">
        ← Dashboard
      </Link>

      <div className="mt-3">
        <h1 className="text-[26px] sm:text-[30px]">Book Resource</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
          Reserve a shared room, vehicle, or piece of equipment by time slot. Overlapping requests are rejected automatically.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <form className="flex max-w-[560px] flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Resource
            <select className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]">
              {RESOURCES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Date
            <input
              type="date"
              className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Start time
              <input
                type="time"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              End time
              <input
                type="time"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Purpose / notes
            <textarea
              rows={3}
              placeholder="What's this booking for?"
              className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
            />
          </label>

          <div className="mt-2 flex gap-3">
            <button type="submit" className="btn btn-accent btn-lg">
              Request booking
            </button>
            <Link href="/dashboard" className="btn btn-ghost btn-lg">
              Cancel
            </Link>
          </div>
        </form>

        <aside>
          <div className="section-head">
            <h2>Today&apos;s bookings</h2>
            <span className="count">Room B2</span>
          </div>
          <div className="panel">
            {EXISTING_BOOKINGS.map((b) => (
              <div key={b.slot} className="list-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>
                  <span className="tag block">{b.slot}</span>
                  <span className="muted">{b.by}</span>
                </span>
                <span className="chip chip-booked">{b.status}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            A request for 10:00–11:00 is fine since it starts right after the last slot ends; anything overlapping 09:00–10:00 or
            13:00–14:30 will be rejected.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

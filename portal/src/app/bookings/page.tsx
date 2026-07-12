"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { bookingsApi } from "@/lib/api/bookings";
import { assetsApi } from "@/lib/api/assets";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  CONFIRMED: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  COMPLETED: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  CANCELLED: { bg: "color-mix(in srgb, var(--hue-coral) 14%, transparent)", fg: "var(--hue-coral)" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

export default function BookingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [resourceFilter, setResourceFilter] = useState("All");

  const bookingsState = useApi((s) => bookingsApi.list({ page_size: 200 }, s));
  const assetsState = useApi((s) => assetsApi.list({ is_bookable: true, page_size: 200 }, s));

  const bookings = bookingsState.data?.items ?? [];
  const resources = assetsState.data?.items ?? [];

  const filtered = useMemo(
    () => (resourceFilter === "All" ? bookings : bookings.filter((b) => b.asset_id === resourceFilter)),
    [bookings, resourceFilter],
  );

  async function cancel(id: string) {
    if (!confirm("Cancel this booking?")) return;
    try {
      await bookingsApi.cancel(id);
      success("Booking cancelled.");
      bookingsState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to cancel.");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Resources</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Resource bookings</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Shared rooms, vehicles, and equipment reserved by time slot.</p>
        </div>
        <Link href="/bookings/new" className="qa-btn primary">+ Book resource</Link>
      </div>

      <div className="asset-dropdowns" style={{ marginTop: 18 }}>
        <label className="asset-dropdown-label">
          Resource
          <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="asset-dropdown">
            <option value="All">All resources</option>
            {resources.map((r) => <option key={r.asset_id} value={r.asset_id}>{r.name}</option>)}
          </select>
        </label>
      </div>

      <div className="section-head" style={{ marginTop: 16 }}>
        <h2>{filtered.length} booking{filtered.length !== 1 ? "s" : ""}</h2>
      </div>

      <div className="panel">
        <div className="list-row" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr auto", background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          <span>Resource</span>
          <span>When</span>
          <span>Booked by</span>
          <span>Status</span>
          <span></span>
        </div>
        {bookingsState.loading ? (
          <div className="list-row"><span className="muted">Loading…</span></div>
        ) : bookingsState.error ? (
          <div className="list-row"><span className="muted">{bookingsState.error}</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="es-icon">∅</div>No bookings yet.</div>
        ) : (
          filtered.map((b) => {
            const s = fmt(b.start_time);
            const e = fmt(b.end_time);
            const style = STATUS_STYLE[b.status] ?? STATUS_STYLE.CONFIRMED;
            const canCancel = b.status === "CONFIRMED" && b.employee_id === user?.employee_id;
            return (
              <div key={b.booking_id} className="list-row" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr auto" }}>
                <span style={{ fontWeight: 600 }}>{b.asset_name ?? "—"}</span>
                <span className="muted" style={{ fontSize: "12.5px" }}>{s.date} · {s.time}–{e.time}</span>
                <span>{b.employee_name ?? "—"}</span>
                <span className="chip" style={{ background: style.bg, color: style.fg }}>{b.status}</span>
                <span>
                  {canCancel && (
                    <button type="button" className="text-[12px] text-[color:var(--hue-coral)] underline" onClick={() => cancel(b.booking_id)}>Cancel</button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

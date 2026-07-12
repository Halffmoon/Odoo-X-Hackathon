"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { assetsApi } from "@/lib/api/assets";
import { bookingsApi } from "@/lib/api/bookings";

const inputCls =
  "rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function BookResourcePage() {
  const router = useRouter();
  const { success } = useToast();

  const assetsState = useApi((s) => assetsApi.list({ is_bookable: true, page_size: 200 }, s));
  const resources = assetsState.data?.items ?? [];

  const [assetId, setAssetId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availState = useApi(
    (s) => (assetId && date ? bookingsApi.availability(assetId, date, s) : Promise.resolve(null)),
    [assetId, date],
  );
  const booked = availState.data?.booked_slots ?? [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!assetId) return setError("Select a resource.");
    if (!date || !startTime || !endTime) return setError("Pick a date, start and end time.");
    if (endTime <= startTime) return setError("End time must be after start time.");
    setSubmitting(true);
    try {
      await bookingsApi.create({
        asset_id: assetId,
        start_time: `${date}T${startTime}:00`,
        end_time: `${date}T${endTime}:00`,
        purpose: purpose.trim() || null,
      });
      success("Booking confirmed.");
      router.push("/bookings");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("That time slot overlaps an existing booking. Pick a different slot.");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to create booking.");
      }
      setSubmitting(false);
    }
  }

  const selectedName = resources.find((r) => r.asset_id === assetId)?.name;

  return (
    <AppShell>
      <Link href="/bookings" className="eyebrow no-underline">← Bookings</Link>

      <div className="mt-3">
        <h1 className="text-[26px] sm:text-[30px]">Book Resource</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
          Reserve a shared room, vehicle, or piece of equipment by time slot. Overlapping requests are rejected automatically.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <form className="flex max-w-[560px] flex-col gap-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[color:var(--hue-coral)]">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Resource
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputCls} required>
              <option value="">{assetsState.loading ? "Loading…" : "— select bookable resource —"}</option>
              {resources.map((r) => <option key={r.asset_id} value={r.asset_id}>{r.asset_tag} · {r.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Start time
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} required />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              End time
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} required />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Purpose / notes
            <textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What's this booking for?" className={inputCls} />
          </label>

          <div className="mt-2 flex gap-3">
            <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>{submitting ? "Booking…" : "Request booking"}</button>
            <Link href="/bookings" className="btn btn-ghost btn-lg">Cancel</Link>
          </div>
        </form>

        <aside>
          <div className="section-head">
            <h2>Booked slots</h2>
            <span className="count">{selectedName ?? "select resource"}</span>
          </div>
          <div className="panel">
            {!assetId || !date ? (
              <div className="list-row"><span className="muted">Pick a resource and date to see existing bookings.</span></div>
            ) : availState.loading ? (
              <div className="list-row"><span className="muted">Loading…</span></div>
            ) : booked.length === 0 ? (
              <div className="list-row"><span className="muted">No bookings — the whole day is free.</span></div>
            ) : (
              booked.map((b, i) => (
                <div key={i} className="list-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>
                    <span className="tag block">{fmtTime(b.start)} – {fmtTime(b.end)}</span>
                    <span className="muted">{b.booked_by ?? "Booked"}</span>
                  </span>
                  <span className="chip chip-booked">Confirmed</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Back-to-back slots are allowed; any overlap with an existing booking is rejected automatically.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

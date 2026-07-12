"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { assetsApi, type AssetCondition } from "@/lib/api/assets";
import { categoriesApi } from "@/lib/api/categories";
import { locationsApi } from "@/lib/api/locations";
import { departmentsApi } from "@/lib/api/departments";
import { dashboardApi } from "@/lib/api/dashboard";

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
];

const HUES: Record<string, { c: string; s: string }> = {
  teal: { c: "var(--hue-teal)", s: "var(--hue-teal-soft)" },
  amber: { c: "var(--hue-amber)", s: "var(--hue-amber-soft)" },
  coral: { c: "var(--hue-coral)", s: "var(--hue-coral-soft)" },
  blue: { c: "var(--hue-blue)", s: "var(--hue-blue-soft)" },
  violet: { c: "var(--hue-violet)", s: "var(--hue-violet-soft)" },
  lime: { c: "var(--hue-lime)", s: "var(--hue-lime-soft)" },
};

const inputCls =
  "rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]";

export default function RegisterAssetPage() {
  const router = useRouter();
  const { success } = useToast();

  const catState = useApi((s) => categoriesApi.list(s));
  const locState = useApi((s) => locationsApi.list(s));
  const deptState = useApi((s) => departmentsApi.list(s));
  const kpiState = useApi((s) => dashboardApi.kpis(s));

  const categories = catState.data ?? [];
  const locations = locState.data ?? [];
  const departments = deptState.data ?? [];

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [serial, setSerial] = useState("");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [acquiredDate, setAcquiredDate] = useState("");
  const [cost, setCost] = useState("");
  const [bookable, setBookable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const kpis = kpiState.data;
  const liveCounts = kpis
    ? [
        { label: "Assets available", value: kpis.assets_available, hue: "teal" },
        { label: "Assets allocated", value: kpis.assets_allocated, hue: "amber" },
        { label: "Maintenance today", value: kpis.maintenance_today, hue: "coral" },
        { label: "Active bookings", value: kpis.active_bookings, hue: "blue" },
        { label: "Pending transfers", value: kpis.pending_transfers, hue: "violet" },
        { label: "Upcoming returns", value: kpis.upcoming_returns.length, hue: "lime" },
      ]
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Asset name is required.");
    if (!categoryId) return setError("Please select a category.");
    setSubmitting(true);
    try {
      const created = await assetsApi.create({
        name: name.trim(),
        category_id: categoryId,
        condition,
        serial_number: serial.trim() || null,
        location_id: locationId || null,
        current_department_id: departmentId || null,
        acquisition_date: acquiredDate || null,
        acquisition_cost: cost ? Number(cost) : null,
        is_bookable: bookable,
      });
      success(`Registered ${created.asset_tag} — ${created.name}.`);
      router.push("/assets");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register asset.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <Link href="/assets" className="eyebrow no-underline">← Assets</Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[30px]">Register Asset</h1>
          <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
            Add a new asset to the directory. It enters the system as <strong className="text-verify">Available</strong> and gets an
            auto-generated tag.
          </p>
        </div>
        <span className="tag rounded-[2px] border border-line bg-paper-raised px-3 py-1.5 font-mono text-[12.5px] text-muted">
          Tag auto-generated on save
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <form className="grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          {error && (
            <div className="sm:col-span-2 rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[color:var(--hue-coral)]">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
            Asset name <span className="text-[color:var(--hue-coral)]">*</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dell Latitude 5440" className={inputCls} required />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Category <span className="text-[color:var(--hue-coral)]">*</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls} required>
              <option value="">{catState.loading ? "Loading…" : "— select —"}</option>
              {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Condition
            <select value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)} className={inputCls}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Serial number
            <input type="text" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="SN-88213-A" className={inputCls} />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Location
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Department
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Acquisition date
            <input type="date" value={acquiredDate} onChange={(e) => setAcquiredDate(e.target.value)} className={inputCls} />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
            Acquisition cost
            <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className={inputCls} />
            <span className="text-[11px] font-normal text-muted">For ranking/reports only — not linked to accounting.</span>
          </label>

          <label className="flex items-center gap-2.5 rounded-[2px] border border-line bg-paper-raised px-3.5 py-3 text-[13.5px] font-medium sm:col-span-2">
            <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Shared / bookable resource
            <span className="font-normal text-muted">— employees can book this by time slot instead of it being allocated to one person.</span>
          </label>

          <div className="mt-2 flex gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>
              {submitting ? "Registering…" : "Register asset"}
            </button>
            <Link href="/assets" className="btn btn-ghost btn-lg">Cancel</Link>
          </div>
        </form>

        <aside>
          <div className="section-head">
            <h2>Live counts</h2>
            <span className="count">org-wide</span>
          </div>
          <div className="kpi-mini-list">
            {kpiState.loading ? (
              <div className="kpi-mini-row"><span className="mlbl muted">Loading…</span></div>
            ) : (
              liveCounts.map((k) => (
                <div key={k.label} className="kpi-mini-row" style={{ ["--m-color" as string]: HUES[k.hue].c, ["--m-soft" as string]: HUES[k.hue].s }}>
                  <span className="mlbl">{k.label}</span>
                  <span className="mval">{k.value}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { reportsApi } from "@/lib/api/reports";

export default function ReportsPage() {
  const { success, error: toastError } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const deptState = useApi((s) => reportsApi.departmentSummary(s));
  const utilState = useApi((s) => reportsApi.utilization(s));
  const maintState = useApi((s) => reportsApi.maintenanceFrequency(s));
  const retireState = useApi((s) => reportsApi.retirementForecast(s));

  const depts = deptState.data ?? [];
  const util = utilState.data ?? [];
  const maint = maintState.data ?? [];
  const retire = retireState.data ?? [];

  const maxAssets = Math.max(1, ...depts.map((d) => d.total_assets));

  async function doExport(type: string) {
    setExporting(type);
    try {
      await reportsApi.export(type, "xlsx");
      success("Export downloaded.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Insights</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Reports</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Utilization, maintenance load, and department distribution across the estate.</p>
        </div>
      </div>

      {/* Department summary */}
      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>Department distribution</h2>
        <button className="qa-btn" onClick={() => doExport("department-summary")} disabled={exporting !== null}>
          {exporting === "department-summary" ? "Exporting…" : "Export xlsx"}
        </button>
      </div>
      <div className="panel" style={{ padding: "16px 18px" }}>
        {deptState.loading ? <span className="muted">Loading…</span> : depts.length === 0 ? <span className="muted">No data.</span> : (
          <div className="flex flex-col gap-3">
            {depts.map((d) => (
              <div key={d.department_id ?? "none"}>
                <div className="flex justify-between text-[12.5px]" style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{d.department_name ?? "Unassigned"}</span>
                  <span className="muted">{d.total_assets} assets · {d.allocated} allocated · {d.available} available · {d.under_maintenance} maint.</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                  <div style={{ width: `${(d.total_assets / maxAssets) * 100}%`, height: "100%", background: "var(--hue-blue)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Utilization */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2>Top asset utilization</h2>
        <button className="qa-btn" onClick={() => doExport("utilization")} disabled={exporting !== null}>
          {exporting === "utilization" ? "Exporting…" : "Export xlsx"}
        </button>
      </div>
      <div className="panel">
        <div className="list-row" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr", background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          <span>Asset</span><span>Allocations</span><span>Total days</span>
        </div>
        {utilState.loading ? <div className="list-row"><span className="muted">Loading…</span></div> : util.length === 0 ? <div className="list-row"><span className="muted">No data.</span></div> : (
          util.slice(0, 10).map((u) => (
            <div key={u.asset_id} className="list-row" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr" }}>
              <span><span className="tag">{u.asset_tag}</span> <span style={{ marginLeft: 6 }}>{u.asset_name}</span></span>
              <span className="muted">{u.allocation_count}</span>
              <span className="muted">{u.total_allocation_days}</span>
            </div>
          ))
        )}
      </div>

      {/* Maintenance frequency */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2>Maintenance frequency</h2>
        <button className="qa-btn" onClick={() => doExport("maintenance-frequency")} disabled={exporting !== null}>
          {exporting === "maintenance-frequency" ? "Exporting…" : "Export xlsx"}
        </button>
      </div>
      <div className="panel">
        <div className="list-row" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr", background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          <span>Asset</span><span>Requests</span><span>Avg hrs</span>
        </div>
        {maintState.loading ? <div className="list-row"><span className="muted">Loading…</span></div> : maint.length === 0 ? <div className="list-row"><span className="muted">No data.</span></div> : (
          maint.slice(0, 10).map((m) => (
            <div key={m.asset_id} className="list-row" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr" }}>
              <span><span className="tag">{m.asset_tag}</span> <span className="muted" style={{ marginLeft: 6 }}>{m.category_name ?? "—"}</span></span>
              <span className="muted">{m.request_count}</span>
              <span className="muted">{m.avg_resolution_hours != null ? m.avg_resolution_hours.toFixed(1) : "—"}</span>
            </div>
          ))
        )}
      </div>

      {/* Retirement forecast */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2>Retirement forecast</h2>
        <button className="qa-btn" onClick={() => doExport("retirement-forecast")} disabled={exporting !== null}>
          {exporting === "retirement-forecast" ? "Exporting…" : "Export xlsx"}
        </button>
      </div>
      <div className="panel">
        {retireState.loading ? <div className="list-row"><span className="muted">Loading…</span></div> : retire.length === 0 ? <div className="list-row"><span className="muted">Nothing flagged for retirement.</span></div> : (
          retire.slice(0, 12).map((r) => (
            <div key={r.asset_id} className="list-row" style={{ gridTemplateColumns: "1.2fr 0.7fr 1.4fr" }}>
              <span><span className="tag">{r.asset_tag}</span> <span style={{ marginLeft: 6 }}>{r.asset_name}</span></span>
              <span className="chip" style={{ background: "var(--hue-amber-soft)", color: "var(--hue-amber)", fontSize: "9.5px", padding: "2px 8px" }}>{r.condition}</span>
              <span className="muted" style={{ fontSize: "12px" }}>{r.reason}</span>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

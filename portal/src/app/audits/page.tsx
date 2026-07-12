"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { auditsApi, discrepanciesApi } from "@/lib/api/audits";
import { departmentsApi } from "@/lib/api/departments";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const FINDING_STYLE: Record<string, { bg: string; fg: string }> = {
  VERIFIED: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  MISSING: { bg: "color-mix(in srgb, var(--hue-coral) 16%, transparent)", fg: "var(--hue-coral)" },
  DAMAGED: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
};

export default function AuditsPage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const canManage = hasRole("ADMIN", "ASSET_MANAGER");

  const cyclesState = useApi((s) => auditsApi.listCycles(undefined, s));
  const discState = useApi((s) => discrepanciesApi.list(undefined, s));
  const deptState = useApi((s) => departmentsApi.list(s));

  const cycles = cyclesState.data ?? [];
  const discrepancies = discState.data ?? [];
  const departments = deptState.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createCycle(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !deptId || !startDate || !endDate) {
      return setFormError("Name, department, and dates are required.");
    }
    setSubmitting(true);
    try {
      await auditsApi.createCycle({ name: name.trim(), department_id: deptId, start_date: startDate, end_date: endDate });
      success("Audit cycle created.");
      setModalOpen(false);
      setName(""); setDeptId(""); setStartDate(""); setEndDate("");
      cyclesState.refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create cycle.");
    } finally {
      setSubmitting(false);
    }
  }

  async function closeCycle(id: string) {
    if (!confirm("Close this audit cycle? Unrecorded in-scope assets will be marked missing.")) return;
    try {
      await auditsApi.closeCycle(id);
      success("Audit cycle closed.");
      cyclesState.refetch();
      discState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to close cycle.");
    }
  }

  async function resolve(id: string) {
    try {
      await discrepanciesApi.resolve(id);
      success("Discrepancy resolved.");
      discState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to resolve.");
    }
  }

  const openDiscrepancies = discrepancies.filter((d) => d.status !== "RESOLVED");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Compliance</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Audit cycles</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Run physical verification cycles and resolve the discrepancies they surface.</p>
        </div>
        {canManage && <button className="qa-btn primary" onClick={() => setModalOpen(true)}>+ New audit cycle</button>}
      </div>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>Cycles</h2>
        <span className="count">{cycles.length}</span>
      </div>
      {cyclesState.loading ? (
        <div className="empty-state">Loading…</div>
      ) : cycles.length === 0 ? (
        <div className="empty-state"><div className="es-icon">∅</div>No audit cycles yet.</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {cycles.map((c) => {
            const p = c.progress;
            const pct = p.total_in_scope ? Math.round((p.recorded / p.total_in_scope) * 100) : 0;
            return (
              <div key={c.audit_cycle_id} className="panel" style={{ padding: "16px 18px" }}>
                <div className="flex items-center justify-between gap-2">
                  <strong style={{ fontSize: "14.5px" }}>{c.name}</strong>
                  <span className="chip" style={{ background: c.status === "OPEN" ? "var(--hue-blue-soft)" : "color-mix(in srgb, var(--muted) 14%, transparent)", color: c.status === "OPEN" ? "var(--hue-blue)" : "var(--muted)", fontSize: "9.5px", padding: "2px 8px" }}>{c.status}</span>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: 4 }}>{fmt(c.start_date)} → {fmt(c.end_date)}</div>
                <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--hue-teal)" }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: "11.5px" }}>
                  <span>{p.recorded}/{p.total_in_scope} recorded</span>
                  <span style={{ color: "var(--verify)" }}>{p.verified} ✓</span>
                  <span style={{ color: "var(--hue-coral)" }}>{p.missing} missing</span>
                  <span style={{ color: "var(--hue-amber)" }}>{p.damaged} damaged</span>
                </div>
                {canManage && c.status === "OPEN" && (
                  <button className="btn btn-ghost mt-3" style={{ padding: "5px 14px", fontSize: "12px" }} onClick={() => closeCycle(c.audit_cycle_id)}>Close cycle</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head" style={{ marginTop: 28 }}>
        <h2 style={{ color: "var(--hue-coral)" }}>Open discrepancies</h2>
        <span className="count">{openDiscrepancies.length}</span>
      </div>
      <div className="panel">
        <div className="list-row" style={{ gridTemplateColumns: "1fr 0.8fr 0.8fr auto", background: "var(--paper-raised)", fontFamily: "ui-monospace, monospace", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          <span>Asset</span>
          <span>Finding</span>
          <span>Status</span>
          <span></span>
        </div>
        {discState.loading ? (
          <div className="list-row"><span className="muted">Loading…</span></div>
        ) : discrepancies.length === 0 ? (
          <div className="list-row"><span className="muted">No discrepancies recorded.</span></div>
        ) : (
          discrepancies.map((d) => (
            <div key={d.discrepancy_id} className="list-row" style={{ gridTemplateColumns: "1fr 0.8fr 0.8fr auto" }}>
              <span className="tag">{d.asset_tag ?? d.asset_id.slice(0, 8)}</span>
              <span className="chip" style={{ background: FINDING_STYLE[d.finding]?.bg, color: FINDING_STYLE[d.finding]?.fg, fontSize: "9.5px", padding: "2px 8px" }}>{d.finding}</span>
              <span className="muted" style={{ fontSize: "12px" }}>{d.status}</span>
              <span>
                {canManage && d.status !== "RESOLVED" && (
                  <button className="text-[12px] text-accent underline" onClick={() => resolve(d.discrepancy_id)}>Resolve</button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="setup-overlay" onClick={() => setModalOpen(false)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>New audit cycle</h2>
              <button className="setup-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            {formError && <div className="mx-6 mb-2 rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3 py-2 text-[12.5px] text-[color:var(--hue-coral)]">{formError}</div>}
            <form className="setup-form" onSubmit={createCycle}>
              <label className="setup-label">Cycle name <span className="req">*</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Engineering Audit" className="setup-input" autoFocus required />
              </label>
              <label className="setup-label">Department scope <span className="req">*</span>
                <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="setup-input" required>
                  <option value="">— select department —</option>
                  {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="setup-label">Start date <span className="req">*</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="setup-input" required />
                </label>
                <label className="setup-label">End date <span className="req">*</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="setup-input" required />
                </label>
              </div>
              <div className="setup-actions">
                <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Creating…" : "Create cycle"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Admin" };

const DEPARTMENTS = ["Engineering", "Sales", "HR", "QA", "Logistics"];
const AUDITORS = ["Arjun Mehta", "Priya Nair", "Ravi Shankar", "Tarun Bhat", "Meena Rao"];

interface AuditAsset {
  tag: string;
  name: string;
  expectedLocation: string;
  verification: "Pending" | "Verified" | "Missing" | "Damaged";
}

interface AuditCycle {
  id: number;
  name: string;
  scopeDept: string;
  startDate: string;
  endDate: string;
  auditors: string[];
  status: "Active" | "Completed";
  assets: AuditAsset[];
}

const INITIAL_CYCLES: AuditCycle[] = [
  {
    id: 1,
    name: "Q3 Audit: Engineering Dept",
    scopeDept: "Engineering",
    startDate: "2026-07-01",
    endDate: "2026-07-15",
    auditors: ["Arjun Mehta", "Priya Nair"],
    status: "Active",
    assets: [
      { tag: "AF-0114", name: "Dell Latitude 5440", expectedLocation: "Bengaluru HQ, Desk 312", verification: "Verified" },
      { tag: "AF-0178", name: "Standing Desk — Adj.", expectedLocation: "Bengaluru HQ, Desk 314", verification: "Pending" },
      { tag: "AF-0098", name: "TP-Link Router AX3000", expectedLocation: "Bengaluru HQ, Desk 419", verification: "Pending" },
    ],
  },
  {
    id: 2,
    name: "Q2 Audit: Sales Dept",
    scopeDept: "Sales",
    startDate: "2026-04-01",
    endDate: "2026-04-15",
    auditors: ["Tarun Bhat"],
    status: "Completed",
    assets: [
      { tag: "AF-0037", name: "Canon Projector EX40", expectedLocation: "Bengaluru HQ, Conf. Room B", verification: "Verified" },
      { tag: "AF-0220", name: "Acer Monitor 27\"", expectedLocation: "Warehouse B", verification: "Verified" },
    ],
  },
];

/* Sample Assets for New Audits based on Department */
const MASTER_ASSETS_BY_DEPT: Record<string, { tag: string; name: string; expectedLocation: string }[]> = {
  Engineering: [
    { tag: "AF-0114", name: "Dell Latitude 5440", expectedLocation: "Bengaluru HQ, Desk 312" },
    { tag: "AF-0178", name: "Standing Desk — Adj.", expectedLocation: "Bengaluru HQ, Desk 314" },
    { tag: "AF-0098", name: "TP-Link Router AX3000", expectedLocation: "Bengaluru HQ, Desk 419" },
  ],
  Sales: [
    { tag: "AF-0037", name: "Canon Projector EX40", expectedLocation: "Bengaluru HQ, Conf. Room B" },
    { tag: "AF-0220", name: "Acer Monitor 27\"", expectedLocation: "Warehouse B" },
  ],
  HR: [
    { tag: "AF-0056", name: "Ergo Chair — Type B", expectedLocation: "Bengaluru HQ, 2nd Floor" },
    { tag: "AF-0140", name: " HP LaserJet Pro MFP", expectedLocation: "Bengaluru HQ, Room 204" },
  ],
  QA: [
    { tag: "AF-0201", name: "Calibration Gauge Set", expectedLocation: "Bengaluru HQ, Lab" },
  ],
  Logistics: [
    { tag: "AF-0075", name: "Bajaj Pulsar (Fleet)", expectedLocation: "Parking Garage B" },
  ],
};

const VERIFY_STYLE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: "color-mix(in srgb, var(--muted) 12%, transparent)", fg: "var(--muted)" },
  Verified: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  Missing: { bg: "color-mix(in srgb, var(--hue-coral) 14%, transparent)", fg: "var(--hue-coral)" },
  Damaged: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
};

/* ── component ──────────────────────────────────────────────── */

export default function AuditsPage() {
  const [cycles, setCycles] = useState<AuditCycle[]>(INITIAL_CYCLES);
  const [activeCycleId, setActiveCycleId] = useState<number>(1);
  const [modalOpen, setModalOpen] = useState(false);

  /* New Cycle Form State */
  const [cycleName, setCycleName] = useState("");
  const [scopeDept, setScopeDept] = useState("Engineering");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);

  const activeCycle = cycles.find((c) => c.id === activeCycleId) ?? null;

  /* status changes */
  const markAsset = (tag: string, status: AuditAsset["verification"]) => {
    if (!activeCycle || activeCycle.status === "Completed") return;

    setCycles((prev) =>
      prev.map((c) => {
        if (c.id === activeCycleId) {
          const updatedAssets = c.assets.map((a) =>
            a.tag === tag ? { ...a, verification: status } : a
          );
          return { ...c, assets: updatedAssets };
        }
        return c;
      })
    );
  };

  function handleCloseCycle() {
    if (!activeCycle) return;
    setCycles((prev) =>
      prev.map((c) => (c.id === activeCycleId ? { ...c, status: "Completed" } : c))
    );
  }

  function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleName.trim() || selectedAuditors.length === 0) return;

    const scopedAssets = MASTER_ASSETS_BY_DEPT[scopeDept] || [];
    const newAssets: AuditAsset[] = scopedAssets.map((ma) => ({
      ...ma,
      verification: "Pending",
    }));

    const newCycle: AuditCycle = {
      id: cycles.length + 1,
      name: cycleName.trim(),
      scopeDept,
      startDate,
      endDate,
      auditors: selectedAuditors,
      status: "Active",
      assets: newAssets.length > 0 ? newAssets : [
        { tag: "AF-NEW", name: "Generic Asset Stub", expectedLocation: "Bengaluru HQ", verification: "Pending" }
      ],
    };

    setCycles((prev) => [newCycle, ...prev]);
    setActiveCycleId(newCycle.id);
    setModalOpen(false);
    
    /* Reset Form */
    setCycleName("");
    setScopeDept("Engineering");
    setStartDate("");
    setEndDate("");
    setSelectedAuditors([]);
  }

  const toggleAuditor = (auditor: string) => {
    setSelectedAuditors((prev) =>
      prev.includes(auditor) ? prev.filter((a) => a !== auditor) : [...prev, auditor]
    );
  };

  /* counts */
  const totalVerified = activeCycle?.assets.filter((a) => a.verification === "Verified").length ?? 0;
  const totalMissing = activeCycle?.assets.filter((a) => a.verification === "Missing").length ?? 0;
  const totalDamaged = activeCycle?.assets.filter((a) => a.verification === "Damaged").length ?? 0;
  const totalPending = activeCycle?.assets.filter((a) => a.verification === "Pending").length ?? 0;
  const totalAssets = activeCycle?.assets.length ?? 0;
  const discrepancyCount = totalMissing + totalDamaged;

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Audits</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Verification &amp; Audits</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Initiate, verify, and close structured asset check cycles to maintain directory accuracy.
          </p>
        </div>
        <button type="button" className="qa-btn primary" onClick={() => setModalOpen(true)}>
          + Create cycle
        </button>
      </div>

      {/* ── main layout ─────────────────────────────── */}
      <div className="audit-layout" style={{ marginTop: 20 }}>
        {/* LEFT COLUMN: Cycle selector and checklist */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Cycle Selector */}
          <div className="flex items-center gap-3">
            <span className="asset-filter-label">Select cycle:</span>
            <select
              value={activeCycleId}
              onChange={(e) => setActiveCycleId(Number(e.target.value))}
              className="alloc-select"
              style={{ margin: 0, width: "auto", flex: "1" }}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          {activeCycle && (
            <div>
              {/* Cycle banner info */}
              <div className="audit-banner">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <h2 className="text-[17px] font-bold">{activeCycle.name}</h2>
                    <p className="mt-1 text-[13px] text-text-soft">
                      Department Scope: <strong>{activeCycle.scopeDept}</strong> · Timeline: {activeCycle.startDate} to {activeCycle.endDate}
                    </p>
                    <div className="mt-2 text-[12px] text-muted">
                      Assigned Auditors: <strong>{activeCycle.auditors.join(", ")}</strong>
                    </div>
                  </div>
                  <span
                    className="chip"
                    style={{
                      background: activeCycle.status === "Active"
                        ? "color-mix(in srgb, var(--verify) 14%, transparent)"
                        : "color-mix(in srgb, var(--muted) 14%, transparent)",
                      color: activeCycle.status === "Active" ? "var(--verify)" : "var(--muted)",
                    }}
                  >
                    {activeCycle.status}
                  </span>
                </div>

                {/* mini stats */}
                <div className="audit-mini-stats mt-4">
                  <div className="astat">
                    <span className="lbl">Verified</span>
                    <span className="n font-mono" style={{ color: "var(--verify)" }}>{totalVerified}</span>
                  </div>
                  <div className="astat">
                    <span className="lbl">Missing</span>
                    <span className="n font-mono" style={{ color: "var(--hue-coral)" }}>{totalMissing}</span>
                  </div>
                  <div className="astat">
                    <span className="lbl">Damaged</span>
                    <span className="n font-mono" style={{ color: "var(--hue-amber)" }}>{totalDamaged}</span>
                  </div>
                  <div className="astat">
                    <span className="lbl">Pending</span>
                    <span className="n font-mono" style={{ color: "var(--muted)" }}>{totalPending}</span>
                  </div>
                </div>
              </div>

              {/* Checklist Table */}
              <div className="panel mt-4">
                <div
                  className="list-row"
                  style={{
                    gridTemplateColumns: "0.8fr 1.4fr 1.2fr 1fr",
                    background: "var(--paper-raised)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "10.5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--muted)",
                  }}
                >
                  <span>Asset</span>
                  <span>Description</span>
                  <span>Expected Location</span>
                  <span style={{ textAlign: "right" }}>Verification</span>
                </div>

                {activeCycle.assets.map((a) => (
                  <div
                    key={a.tag}
                    className="list-row"
                    style={{ gridTemplateColumns: "0.8fr 1.4fr 1.2fr 1fr" }}
                  >
                    <span className="tag">{a.tag}</span>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    <span className="muted" style={{ fontSize: "12.5px" }}>{a.expectedLocation}</span>
                    <div className="flex justify-end gap-1.5">
                      {activeCycle.status === "Active" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => markAsset(a.tag, "Verified")}
                            className={`audit-btn verified ${a.verification === "Verified" ? "active" : ""}`}
                            title="Verify Asset"
                          >
                            Verified
                          </button>
                          <button
                            type="button"
                            onClick={() => markAsset(a.tag, "Missing")}
                            className={`audit-btn missing ${a.verification === "Missing" ? "active" : ""}`}
                            title="Mark Missing"
                          >
                            Missing
                          </button>
                          <button
                            type="button"
                            onClick={() => markAsset(a.tag, "Damaged")}
                            className={`audit-btn damaged ${a.verification === "Damaged" ? "active" : ""}`}
                            title="Mark Damaged"
                          >
                            Damaged
                          </button>
                        </>
                      ) : (
                        <span
                          className="chip"
                          style={{
                            background: VERIFY_STYLE[a.verification].bg,
                            color: VERIFY_STYLE[a.verification].fg,
                          }}
                        >
                          {a.verification}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Discrepancy warning banner */}
              {discrepancyCount > 0 && (
                <div className="alloc-conflict mt-4" style={{ margin: "16px 0 0" }}>
                  <div className="alloc-conflict-icon">!</div>
                  <div className="flex-1">
                    <strong>{discrepancyCount} assets flagged</strong>
                    <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--text-soft)" }}>
                      Discrepancy report generated automatically. Confirming this cycle will auto-flag missing items as <strong className="text-accent">Lost</strong> and damaged items as <strong className="text-accent">Needs Repair</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Close Button */}
              {activeCycle.status === "Active" && (
                <div className="mt-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleCloseCycle}
                    disabled={totalPending > 0}
                    className="btn btn-accent btn-lg"
                    style={totalPending > 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    Close audit cycle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Audit history log and discrepancies */}
        <aside className="audit-aside">
          {/* Discrepancy report list */}
          {activeCycle && discrepancyCount > 0 && (
            <div>
              <div className="section-head">
                <h2 style={{ color: "var(--hue-coral)" }}>Discrepancies</h2>
                <span className="count">flagged</span>
              </div>
              <div className="panel p-3 flex flex-col gap-2.5">
                {activeCycle.assets
                  .filter((a) => a.verification === "Missing" || a.verification === "Damaged")
                  .map((a) => (
                    <div key={a.tag} className="discrepancy-item">
                      <div className="flex items-center justify-between">
                        <span className="tag">{a.tag}</span>
                        <span
                          className="chip"
                          style={{
                            fontSize: "9px",
                            padding: "2px 6px",
                            background: VERIFY_STYLE[a.verification].bg,
                            color: VERIFY_STYLE[a.verification].fg,
                          }}
                        >
                          {a.verification}
                        </span>
                      </div>
                      <h4 className="text-[12.5px] font-bold mt-1">{a.name}</h4>
                      <p className="text-[11px] text-muted mt-0.5">Expected at: {a.expectedLocation}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Audit History retained per cycle */}
          <div>
            <div className="section-head" style={{ marginTop: discrepancyCount > 0 ? 18 : 0 }}>
              <h2>Cycle history</h2>
              <span className="count">retained</span>
            </div>
            <div className="panel">
              <div className="activity-item">
                <span className="adot" style={{ ["--a-color" as string]: "var(--verify)" }} />
                <span className="flex-1">Cycle Q3 started scoped for Engineering</span>
                <span className="atime">01 Jul</span>
              </div>
              <div className="activity-item">
                <span className="adot" style={{ ["--a-color" as string]: "var(--hue-blue)" }} />
                <span className="flex-1">Auditors Arjun Mehta &amp; Priya Nair assigned</span>
                <span className="atime">01 Jul</span>
              </div>
              <div className="activity-item">
                <span className="adot" style={{ ["--a-color" as string]: "var(--verify)" }} />
                <span className="flex-1">Asset AF-0114 verified at Desk 312</span>
                <span className="atime">04 Jul</span>
              </div>
              {totalMissing > 0 && (
                <div className="activity-item">
                  <span className="adot" style={{ ["--a-color" as string]: "var(--hue-coral)" }} />
                  <span className="flex-1">Asset marked Missing during check</span>
                  <span className="atime">Today</span>
                </div>
              )}
              {activeCycle?.status === "Completed" && (
                <div className="activity-item">
                  <span className="adot" style={{ ["--a-color" as string]: "var(--muted)" }} />
                  <span className="flex-1">Cycle closed and locked successfully</span>
                  <span className="atime">Just now</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── CREATE AUDIT CYCLE MODAL ────────────────── */}
      {modalOpen && (
        <div className="setup-overlay" onClick={() => setModalOpen(false)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Create Audit Cycle</h2>
              <button type="button" className="setup-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleCreateCycle}>
              <label className="setup-label">
                Cycle name <span className="req">*</span>
                <input
                  type="text"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  placeholder="e.g. Q4 Audit: Marketing"
                  className="setup-input"
                  required
                />
              </label>

              <label className="setup-label">
                Scope Department <span className="req">*</span>
                <select
                  value={scopeDept}
                  onChange={(e) => setScopeDept(e.target.value)}
                  className="setup-input"
                  required
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <span className="setup-hint">Selecting a department automatically scopes all assets currently held there.</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="setup-label">
                  Start Date <span className="req">*</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="setup-input"
                    required
                  />
                </label>
                <label className="setup-label">
                  End Date <span className="req">*</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="setup-input"
                    required
                  />
                </label>
              </div>

              <label className="setup-label">
                Assign Auditors <span className="req">*</span>
                <div className="setup-auditors-list">
                  {AUDITORS.map((aud) => (
                    <label key={aud} className="flex items-center gap-2 py-1 select-none font-normal" style={{ fontSize: "13px" }}>
                      <input
                        type="checkbox"
                        checked={selectedAuditors.includes(aud)}
                        onChange={() => toggleAuditor(aud)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      {aud}
                    </label>
                  ))}
                </div>
              </label>

              <div className="setup-actions">
                <button
                  type="submit"
                  disabled={selectedAuditors.length === 0}
                  className="btn btn-accent"
                  style={selectedAuditors.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  Create Cycle
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

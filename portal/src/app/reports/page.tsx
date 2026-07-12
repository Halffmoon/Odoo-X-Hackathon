"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const DEPT_UTILIZATION = [
  { dept: "Engineering", pct: 92, count: 18, hue: "var(--hue-blue)" },
  { dept: "Sales", pct: 78, count: 12, hue: "var(--hue-amber)" },
  { dept: "HR", pct: 65, count: 8, hue: "var(--verify)" },
  { dept: "QA", pct: 82, count: 15, hue: "var(--hue-violet)" },
  { dept: "Logistics", pct: 70, count: 6, hue: "var(--hue-coral)" },
];

const MOST_USED = [
  { name: "Room B2 — Conference", hours: 114, pct: 95 },
  { name: "Fleet Vehicle — KA01 AB 4521", hours: 87, pct: 72 },
  { name: "Canon Projector EX40", hours: 58, pct: 48 },
];

const IDLE_ASSETS = [
  { tag: "AF-0220", name: "Acer Monitor 27\"", days: 68, cost: "₹19,200" },
  { tag: "AF-0140", name: "HP LaserJet Pro MFP", days: 45, cost: "₹32,400" },
  { tag: "AF-0092", name: "Standing Desk — Adj.", days: 32, cost: "₹24,500" },
];

const DUE_MAINTENANCE = [
  { tag: "AF-0075", name: "Bajaj Pulsar (Fleet)", action: "Annual Service", dueIn: "8 days", labelColor: "var(--hue-coral)" },
  { tag: "AF-0114", name: "Dell Latitude 5440", action: "Battery Diagnostic", dueIn: "14 days", labelColor: "var(--hue-amber)" },
  { tag: "AF-0140", name: "HP LaserJet Pro MFP", action: "Roller Replacement", dueIn: "19 days", labelColor: "var(--muted)" },
];

const RETIREMENTS = [
  { tag: "AF-0002", name: "Lenovo ThinkPad T480", age: "4.2 years", limit: "4.0 years", status: "Overdue Retirement", labelColor: "var(--hue-coral)" },
  { tag: "AF-0056", name: "Ergo Chair — Type B", age: "3.8 years", limit: "4.0 years", status: "Retire in 2 months", labelColor: "var(--hue-amber)" },
];

const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HEATMAP_HOURS = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];

/* Seeding booking intensity density values (0 to 4) for heatmap grid */
const HEATMAP_DATA = [
  [3, 4, 1, 3, 2], // 09:00
  [4, 4, 2, 4, 1], // 11:00
  [0, 1, 0, 0, 0], // 13:00 (Lunch cooldown)
  [3, 3, 4, 2, 3], // 15:00
  [2, 3, 2, 3, 1], // 17:00
  [1, 1, 0, 1, 0], // 19:00
];

export default function ReportsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [reportType, setReportType] = useState("Operational Snapshot");
  const [exportFormat, setExportFormat] = useState("PDF");
  const [exportSuccess, setExportSuccess] = useState(false);

  function handleExportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      setModalOpen(false);
    }, 1800);
  }

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Reports &amp; Analytics</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Actionable operational insight into asset utilization, maintenance frequencies, and lifecycle planning.
          </p>
        </div>
        <button type="button" className="qa-btn primary" onClick={() => setModalOpen(true)}>
          Export report
        </button>
      </div>

      {/* ── metric strip ────────────────────────────── */}
      <div className="kpi-card-grid mt-6">
        <div className="kpi-card" style={{ ["--k-color" as string]: "var(--hue-blue)" }}>
          <span className="lbl">Average Asset Utilization</span>
          <span className="num mt-1">84.2%</span>
          <span className="muted text-[11px] mt-1">Peak: Mon/Wed 11:00 AM</span>
        </div>
        <div className="kpi-card" style={{ ["--k-color" as string]: "var(--verify)" }}>
          <span className="lbl">Total Maintenance Cost</span>
          <span className="num mt-1">₹3,42,800</span>
          <span className="muted text-[11px] mt-1">YTD · 14 service events</span>
        </div>
        <div className="kpi-card" style={{ ["--k-color" as string]: "var(--hue-amber)" }}>
          <span className="lbl">Idle Assets Rate</span>
          <span className="num mt-1">12.5%</span>
          <span className="muted text-[11px] mt-1">3 items unused &gt; 30 days</span>
        </div>
      </div>

      {/* ── CHARTS CONTAINER ────────────────────────── */}
      <div className="reports-charts mt-6">
        {/* Left: Department utilization bar chart */}
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <h2>Utilization by Department</h2>
              <p>Asset allocation density relative to department size</p>
            </div>
            <span className="chart-pill">Live</span>
          </div>

          <div className="bar-chart-container mt-6">
            {DEPT_UTILIZATION.map((item) => (
              <div key={item.dept} className="bar-chart-row">
                <span className="bar-label">{item.dept}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${item.pct}%`,
                      background: item.hue,
                    }}
                  />
                </div>
                <span className="bar-value font-mono">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Maintenance frequency SVG line chart */}
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <h2>Maintenance Frequency</h2>
              <p>Total reported repair cases per month (YTD)</p>
            </div>
            <span className="chart-pill">Live</span>
          </div>

          {/* Handcrafted responsive line chart */}
          <div className="svg-chart-wrapper mt-4">
            <svg viewBox="0 0 400 180" className="w-full h-full">
              {/* grid lines */}
              <line x1="40" y1="20" x2="380" y2="20" stroke="var(--line)" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="40" y1="60" x2="380" y2="60" stroke="var(--line)" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="380" y2="100" stroke="var(--line)" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="40" y1="140" x2="380" y2="140" stroke="var(--line)" strokeWidth="0.8" />

              {/* Y Axis Labels */}
              <text x="32" y="24" fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="monospace">12</text>
              <text x="32" y="64" fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="monospace">8</text>
              <text x="32" y="104" fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="monospace">4</text>
              <text x="32" y="144" fill="var(--muted)" fontSize="9" textAnchor="end" fontFamily="monospace">0</text>

              {/* Month X Labels */}
              <text x="50" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">Jan</text>
              <text x="110" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">Feb</text>
              <text x="170" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">Mar</text>
              <text x="230" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">Apr</text>
              <text x="290" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">May</text>
              <text x="350" y="162" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="600">Jun</text>

              {/* Data Trend Line */}
              {/* Coordinates plotted dynamically for: Jan: 2 (120), Feb: 5 (90), Mar: 3 (110), Apr: 8 (60), May: 6 (80), Jun: 11 (30) */}
              <polyline
                fill="none"
                stroke="var(--hue-coral)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="50,120 110,90 170,110 230,60 290,80 350,30"
              />

              {/* Data points */}
              <circle cx="50" cy="120" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
              <circle cx="110" cy="90" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
              <circle cx="170" cy="110" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
              <circle cx="230" cy="60" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
              <circle cx="290" cy="80" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
              <circle cx="350" cy="30" r="3.5" fill="var(--paper-raised)" stroke="var(--hue-coral)" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── LOWER SECTION GRID ──────────────────────── */}
      <div className="reports-detail-grid mt-6">
        {/* LEFT COLUMN: Utilization ranking & idle */}
        <div className="flex flex-col gap-6">
          {/* Most-used assets */}
          <div>
            <div className="section-head">
              <h2>Most-Used Shared Resources</h2>
              <span className="count">hours booked (this month)</span>
            </div>
            <div className="panel p-3 flex flex-col gap-3">
              {MOST_USED.map((mu, i) => (
                <div key={i} className="util-ranking-item">
                  <div className="flex justify-between text-[13px] font-semibold">
                    <span>{mu.name}</span>
                    <span className="font-mono">{mu.hours} hrs</span>
                  </div>
                  <div className="bar-track mt-1.5" style={{ height: 6 }}>
                    <div className="bar-fill" style={{ width: `${mu.pct}%`, background: "var(--hue-blue)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Idle assets */}
          <div>
            <div className="section-head">
              <h2>Idle Assets</h2>
              <span className="count">unallocated duration</span>
            </div>
            <div className="panel">
              <div
                className="list-row"
                style={{
                  gridTemplateColumns: "0.8fr 1.6fr 1fr 1fr",
                  background: "var(--paper-raised)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "10.5px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted)",
                }}
              >
                <span>Tag</span>
                <span>Name</span>
                <span>Idle Time</span>
                <span>Original Cost</span>
              </div>
              {IDLE_ASSETS.map((ia) => (
                <div key={ia.tag} className="list-row" style={{ gridTemplateColumns: "0.8fr 1.6fr 1fr 1fr" }}>
                  <span className="tag">{ia.tag}</span>
                  <span style={{ fontWeight: 600 }}>{ia.name}</span>
                  <span className="text-accent font-bold" style={{ fontSize: "12.5px" }}>{ia.days} days</span>
                  <span className="muted font-mono">{ia.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Life cycles & Maintenance alerts */}
        <div className="flex flex-col gap-6">
          {/* Due for Maintenance */}
          <div>
            <div className="section-head">
              <h2>Service &amp; Calibration Due</h2>
              <span className="count">approaching deadlines</span>
            </div>
            <div className="panel p-3.5 flex flex-col gap-3">
              {DUE_MAINTENANCE.map((dm) => (
                <div key={dm.tag} className="alert-card-row">
                  <span className="h-1.5 w-1.5 rounded-full flex-none mt-2" style={{ background: dm.labelColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="tag" style={{ fontSize: "10.5px" }}>{dm.tag}</span>
                      <span className="font-bold font-mono text-[11px]" style={{ color: dm.labelColor }}>Due in {dm.dueIn}</span>
                    </div>
                    <h4 className="text-[12.5px] font-bold mt-1 text-text truncate">{dm.name}</h4>
                    <p className="text-[11.5px] text-muted mt-0.5">Required check: {dm.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retirements */}
          <div>
            <div className="section-head">
              <h2>Assets Nearing Retirement</h2>
              <span className="count">past useful lifecycle</span>
            </div>
            <div className="panel p-3.5 flex flex-col gap-3">
              {RETIREMENTS.map((r) => (
                <div key={r.tag} className="alert-card-row">
                  <span className="h-1.5 w-1.5 rounded-full flex-none mt-2" style={{ background: r.labelColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="tag" style={{ fontSize: "10.5px" }}>{r.tag}</span>
                      <span className="font-bold text-[11px]" style={{ color: r.labelColor }}>{r.status}</span>
                    </div>
                    <h4 className="text-[12.5px] font-bold mt-1 text-text truncate">{r.name}</h4>
                    <p className="text-[11.5px] text-muted mt-0.5">Age: {r.age} (limit: {r.limit})</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RESOURCE BOOKING HEATMAP ────────────────── */}
      <div className="mt-8">
        <div className="section-head">
          <h2>Resource Booking Heatmap</h2>
          <span className="count">peak usage windows (Mon-Fri)</span>
        </div>
        <div className="panel overflow-hidden">
          <div className="heatmap-container">
            {/* Headers row */}
            <div className="heatmap-row head">
              <span className="hour-label">Hour</span>
              {HEATMAP_DAYS.map((d) => (
                <span key={d} className="day-header">{d}</span>
              ))}
            </div>

            {/* Matrix */}
            {HEATMAP_HOURS.map((hr, hrIndex) => (
              <div key={hr} className="heatmap-row">
                <span className="hour-label font-mono">{hr}</span>
                {HEATMAP_DAYS.map((_, dayIndex) => {
                  const val = HEATMAP_DATA[hrIndex]?.[dayIndex] ?? 0;
                  // Shading opacities: 0: 0.05, 1: 0.15, 2: 0.35, 3: 0.6, 4: 0.85
                  const opacity = val === 0 ? 0.05 : val === 1 ? 0.2 : val === 2 ? 0.45 : val === 3 ? 0.7 : 0.9;
                  const titleMsg = val === 0 ? "No usage" : val === 1 ? "Light bookings" : val === 2 ? "Moderate bookings" : val === 3 ? "Heavy bookings" : "Peak saturation window";

                  return (
                    <div
                      key={dayIndex}
                      className="heatmap-cell"
                      style={{
                        background: `rgba(58, 107, 201, ${opacity})`,
                      }}
                      title={`${hr} on ${HEATMAP_DAYS[dayIndex]}: ${titleMsg}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="setup-table-footer flex justify-between items-center gap-4 flex-wrap">
            <span className="italic">Heatmap shows peak traffic. Darkest cells represent concurrent conference room and vehicle bookings.</span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ fontSize: "10.5px" }}>
              <span>Low</span>
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "rgba(58, 107, 201, 0.05)" }} />
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "rgba(58, 107, 201, 0.2)" }} />
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "rgba(58, 107, 201, 0.45)" }} />
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "rgba(58, 107, 201, 0.7)" }} />
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "rgba(58, 107, 201, 0.9)" }} />
              <span>Peak</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── EXPORT MODAL ────────────────────────────── */}
      {modalOpen && (
        <div className="setup-overlay" onClick={() => setModalOpen(false)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Export Operational Report</h2>
              <button type="button" className="setup-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleExportSubmit}>
              <label className="setup-label">
                Report Type <span className="req">*</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="setup-input"
                  required
                >
                  <option>Operational Snapshot</option>
                  <option>Discrepancy Audit Log</option>
                  <option>Maintenance &amp; Service History</option>
                  <option>Department-wise Allocation Summary</option>
                </select>
              </label>

              <label className="setup-label">
                Export Format <span className="req">*</span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="setup-input"
                  required
                >
                  <option>PDF (Print-Optimized)</option>
                  <option>Excel Worksheet (.xlsx)</option>
                  <option>Comma Separated Values (.csv)</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="setup-label">
                  Filter Start Date
                  <input type="date" className="setup-input" defaultValue="2026-07-01" />
                </label>
                <label className="setup-label">
                  Filter End Date
                  <input type="date" className="setup-input" defaultValue="2026-07-15" />
                </label>
              </div>

              {exportSuccess ? (
                <div className="alloc-conflict" style={{ margin: "4px 0", background: "color-mix(in srgb, var(--verify) 10%, transparent)", borderColor: "color-mix(in srgb, var(--verify) 20%, transparent)" }}>
                  <div className="alloc-conflict-icon" style={{ background: "var(--verify)" }}>✓</div>
                  <div style={{ fontSize: "13px" }}>
                    <strong>Exporting report…</strong>
                    <p style={{ margin: "2px 0 0", color: "var(--text-soft)" }}>
                      Your report has compiled successfully. Download starting shortly.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted italic">
                  Report includes all scoped properties, timestamps, custom fields, and transition logs.
                </p>
              )}

              <div className="setup-actions">
                <button
                  type="submit"
                  disabled={exportSuccess}
                  className="btn btn-accent"
                  style={exportSuccess ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  Download Report
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

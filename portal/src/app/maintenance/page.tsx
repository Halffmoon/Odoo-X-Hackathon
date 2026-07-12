"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const TECHNICIANS = ["Ramesh Kumar", "Suresh Patel", "Anjali Sharma"];

interface MaintenanceRequest {
  id: number;
  tag: string;
  assetName: string;
  issue: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  reportedBy: string;
  date: string;
  status: "Pending" | "Approved" | "Technician Assigned" | "In Progress" | "Resolved" | "Rejected";
  technician: string | null;
  resolutionNotes: string | null;
}

const INITIAL_REQUESTS: MaintenanceRequest[] = [
  {
    id: 1,
    tag: "AF-0062",
    assetName: "Canon Projector EX40",
    issue: "Projector lamp not turning on / flickering",
    priority: "High",
    reportedBy: "Priya Nair",
    date: "11 Jul 2025",
    status: "Pending",
    technician: null,
    resolutionNotes: null,
  },
  {
    id: 2,
    tag: "AF-0015",
    assetName: "Voltas AC 1.5 Ton",
    issue: "AC unit making loud compressor noise, not cooling",
    priority: "Medium",
    reportedBy: "HR Department",
    date: "10 Jul 2025",
    status: "Approved",
    technician: null,
    resolutionNotes: null,
  },
  {
    id: 3,
    tag: "AF-0098",
    assetName: "TP-Link Router AX3000",
    issue: "WiFi dropping connection every 15 minutes",
    priority: "Critical",
    reportedBy: "QA Lab",
    date: "09 Jul 2025",
    status: "Technician Assigned",
    technician: "Ramesh Kumar",
    resolutionNotes: null,
  },
  {
    id: 4,
    tag: "AF-0114",
    assetName: "Dell Latitude 5440",
    issue: "Laptop keyboard keys sticking (E, R, T)",
    priority: "High",
    reportedBy: "Sana Qureshi",
    date: "08 Jul 2025",
    status: "In Progress",
    technician: "Suresh Patel",
    resolutionNotes: null,
  },
  {
    id: 5,
    tag: "AF-0205",
    assetName: "Ergo Chair — Type B",
    issue: "Armrest loose and wobbling",
    priority: "Low",
    reportedBy: "Rohan Iyer",
    date: "06 Jul 2025",
    status: "Resolved",
    technician: "Anjali Sharma",
    resolutionNotes: "Tightened all support bolts and replaced worn washer.",
  },
];

const COLUMNS: { key: MaintenanceRequest["status"]; label: string; hue: string }[] = [
  { key: "Pending", label: "Pending", hue: "var(--hue-amber)" },
  { key: "Approved", label: "Approved", hue: "var(--hue-blue)" },
  { key: "Technician Assigned", label: "Technician Assigned", hue: "var(--hue-violet)" },
  { key: "In Progress", label: "In Progress", hue: "var(--hue-coral)" },
  { key: "Resolved", label: "Resolved", hue: "var(--verify)" },
];

const PRIORITY_COLOR: Record<string, string> = {
  Low: "color-mix(in srgb, var(--muted) 14%, transparent)",
  Medium: "var(--hue-blue-soft)",
  High: "var(--hue-amber-soft)",
  Critical: "color-mix(in srgb, var(--hue-coral) 14%, transparent)",
};

const PRIORITY_TEXT: Record<string, string> = {
  Low: "var(--muted)",
  Medium: "var(--hue-blue)",
  High: "var(--hue-amber)",
  Critical: "var(--hue-coral)",
};

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>(INITIAL_REQUESTS);
  const [selectedTechs, setSelectedTechs] = useState<Record<number, string>>({});
  const [filterPriority, setFilterPriority] = useState<string>("All");
  
  /* Resolve Modal State */
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const activeRequest = resolveId !== null ? requests.find((r) => r.id === resolveId) ?? null : null;

  /* filter requests */
  const filteredRequests = requests.filter((r) => {
    if (filterPriority !== "All" && r.priority !== filterPriority) return false;
    return true;
  });

  /* update status */
  const updateStatus = (id: number, newStatus: MaintenanceRequest["status"], extra: Partial<MaintenanceRequest> = {}) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus, ...extra } : r))
    );
  };

  function handleAssign(id: number) {
    const tech = selectedTechs[id];
    if (!tech) return;
    updateStatus(id, "Technician Assigned", { technician: tech });
  }

  function handleResolveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (resolveId === null) return;
    updateStatus(resolveId, "Resolved", { resolutionNotes: notes.trim() || "Resolved successfully." });
    setResolveId(null);
    setNotes("");
  }

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Maintenance</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Maintenance Management</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Route asset repairs through approvals and track them in real time across the board.
          </p>
        </div>
        <Link href="/maintenance/new" className="qa-btn primary">
          + Raise request
        </Link>
      </div>

      {/* ── toolbar filters ────────────────────────── */}
      <div className="booking-toolbar">
        <label className="asset-dropdown-label">
          Filter by Priority:
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="asset-dropdown"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </label>
        <span className="count text-[13px] text-muted font-mono">
          Showing {filteredRequests.length} active request{filteredRequests.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── KANBAN BOARD ────────────────────────────── */}
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const colRequests = filteredRequests.filter((r) => r.status === col.key);

          return (
            <div key={col.key} className="kanban-col">
              {/* col header */}
              <div className="kanban-col-header" style={{ ["--col-hue" as string]: col.hue }}>
                <span className="dot" />
                <span className="lbl">{col.label}</span>
                <span className="tab-count" style={{ background: "var(--paper-raised)" }}>{colRequests.length}</span>
              </div>

              {/* col body */}
              <div className="kanban-cards-container">
                {colRequests.length === 0 ? (
                  <div className="kanban-empty-slot">
                    No requests
                  </div>
                ) : (
                  colRequests.map((r) => (
                    <div key={r.id} className="kanban-card">
                      {/* card top info */}
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="tag" style={{ fontSize: "11px" }}>{r.tag}</span>
                        <span
                          className="chip"
                          style={{
                            fontSize: "9px",
                            padding: "2px 7px",
                            background: PRIORITY_COLOR[r.priority],
                            color: PRIORITY_TEXT[r.priority],
                          }}
                        >
                          {r.priority}
                        </span>
                      </div>

                      {/* asset name & issue */}
                      <h4 className="mt-2 text-[13px] font-bold text-text truncate-card-title">{r.assetName}</h4>
                      <p className="mt-1 text-[12px] text-text-soft leading-relaxed line-clamp-3">{r.issue}</p>

                      {/* metadata */}
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[10.5px] text-muted">
                        <span>By {r.reportedBy}</span>
                        <span>{r.date}</span>
                      </div>

                      {/* card technician assigned label */}
                      {r.technician && (
                        <div className="mt-2 text-[11px] font-semibold text-text-soft bg-paper px-2 py-1 rounded-[2px] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hue-violet)]" />
                          Tech: {r.technician}
                        </div>
                      )}

                      {/* column-specific action buttons */}
                      <div className="mt-3.5 border-t border-dashed border-line pt-3 flex flex-col gap-2">
                        {r.status === "Pending" && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateStatus(r.id, "Approved")}
                              className="btn btn-accent"
                              style={{ width: "100%", justifyContent: "center", padding: "6px 12px", fontSize: "11.5px" }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(r.id, "Rejected")}
                              className="btn btn-ghost"
                              style={{ width: "100%", justifyContent: "center", padding: "6px 12px", fontSize: "11.5px" }}
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {r.status === "Approved" && (
                          <div className="flex flex-col gap-2">
                            <select
                              value={selectedTechs[r.id] || ""}
                              onChange={(e) => setSelectedTechs({ ...selectedTechs, [r.id]: e.target.value })}
                              className="setup-input"
                              style={{ padding: "5px 8px", fontSize: "12px", background: "var(--paper)" }}
                            >
                              <option value="">— assign tech —</option>
                              {TECHNICIANS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAssign(r.id)}
                              disabled={!selectedTechs[r.id]}
                              className="btn btn-solid"
                              style={{
                                width: "100%",
                                justifyContent: "center",
                                padding: "6px 12px",
                                fontSize: "11.5px",
                                opacity: selectedTechs[r.id] ? 1 : 0.5,
                                cursor: selectedTechs[r.id] ? "pointer" : "not-allowed",
                              }}
                            >
                              Assign
                            </button>
                          </div>
                        )}

                        {r.status === "Technician Assigned" && (
                          <button
                            type="button"
                            onClick={() => updateStatus(r.id, "In Progress")}
                            className="btn btn-solid"
                            style={{ width: "100%", justifyContent: "center", padding: "6px 12px", fontSize: "11.5px" }}
                          >
                            Start Work
                          </button>
                        )}

                        {r.status === "In Progress" && (
                          <button
                            type="button"
                            onClick={() => setResolveId(r.id)}
                            className="btn btn-accent"
                            style={{ width: "100%", justifyContent: "center", padding: "6px 12px", fontSize: "11.5px" }}
                          >
                            Mark Resolved
                          </button>
                        )}

                        {r.status === "Resolved" && r.resolutionNotes && (
                          <div className="text-[11px] italic text-muted text-wrap">
                            Note: &ldquo;{r.resolutionNotes}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── RESOLVE DIALOG MODAL ────────────────────── */}
      {activeRequest && (
        <div className="setup-overlay" onClick={() => setResolveId(null)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Resolve Maintenance Request</h2>
              <button type="button" className="setup-close" onClick={() => setResolveId(null)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleResolveSubmit}>
              <div style={{ fontSize: "13.5px" }}>
                <span className="tag">{activeRequest.tag}</span>
                <span style={{ fontWeight: 600, marginLeft: 6 }}>{activeRequest.assetName}</span>
                <div style={{ marginTop: 4, fontSize: "12.5px", color: "var(--text-soft)" }}>
                  Repaired by <strong>{activeRequest.technician}</strong>
                </div>
              </div>
              <label className="setup-label">
                Resolution check-in notes <span className="req">*</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what was fixed, parts replaced, etc…"
                  rows={4}
                  className="setup-input"
                  style={{ resize: "vertical" }}
                  required
                />
              </label>
              <div className="setup-actions">
                <button type="submit" className="btn btn-accent">Confirm Resolution</button>
                <button type="button" className="btn btn-ghost" onClick={() => setResolveId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

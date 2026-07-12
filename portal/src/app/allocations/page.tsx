"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

/* ── mock data ──────────────────────────────────────────────── */

type AssetStatus = "Available" | "Allocated" | "Reserved" | "Under Maintenance";

interface AssetStub {
  tag: string;
  name: string;
  status: AssetStatus;
  holder: string | null;
  holderDept: string | null;
  returnDate: string | null;
  overdue: boolean;
}

const ASSETS: AssetStub[] = [
  { tag: "AF-0001", name: "Dell Latitude 5440", status: "Allocated", holder: "Priya Nair", holderDept: "Engineering", returnDate: "03 Jul 2025", overdue: true },
  { tag: "AF-0037", name: "Canon Projector EX40", status: "Available", holder: null, holderDept: null, returnDate: null, overdue: false },
  { tag: "AF-0056", name: "Ergo Chair — Type B", status: "Allocated", holder: "Rohan Iyer", holderDept: "HR", returnDate: null, overdue: false },
  { tag: "AF-0075", name: "Bajaj Pulsar (Fleet)", status: "Reserved", holder: "Logistics", holderDept: "Logistics", returnDate: "20 Jul 2025", overdue: false },
  { tag: "AF-0114", name: "MacBook Pro 14\"", status: "Under Maintenance", holder: "Sana Qureshi", holderDept: "Engineering", returnDate: null, overdue: false },
  { tag: "AF-0140", name: "HP LaserJet Pro MFP", status: "Available", holder: null, holderDept: null, returnDate: null, overdue: false },
  { tag: "AF-0178", name: "Standing Desk — Adj.", status: "Allocated", holder: "Arjun Mehta", holderDept: "Engineering", returnDate: "30 Jul 2025", overdue: false },
];

const EMPLOYEES = [
  "Priya Nair", "Ravi Shankar", "Sana Qureshi", "Rohan Iyer",
  "Tarun Bhat", "Meena Rao", "Kiran Desai", "Arjun Mehta",
];

type TransferStatus = "Requested" | "Approved" | "Re-allocated" | "Rejected";

interface Transfer {
  id: number;
  tag: string;
  asset: string;
  from: string;
  to: string;
  status: TransferStatus;
  date: string;
  approver: string | null;
}

const TRANSFERS_INIT: Transfer[] = [
  { id: 1, tag: "AF-0001", asset: "Dell Latitude 5440", from: "Priya Nair", to: "Ravi Shankar", status: "Requested", date: "12 Jul 2025", approver: null },
  { id: 2, tag: "AF-0056", asset: "Ergo Chair — Type B", from: "Rohan Iyer", to: "Sana Qureshi", status: "Approved", date: "10 Jul 2025", approver: "Arjun Mehta" },
  { id: 3, tag: "AF-0178", asset: "Standing Desk — Adj.", from: "Kiran Desai", to: "Arjun Mehta", status: "Re-allocated", date: "05 Jul 2025", approver: "Arjun Mehta" },
];

interface HistoryEntry {
  date: string;
  text: string;
  type: "allocate" | "return" | "transfer" | "overdue";
}

const HISTORY: HistoryEntry[] = [
  { date: "12 Jul", text: "Transfer request: AF-0001 from Priya Nair → Ravi Shankar", type: "transfer" },
  { date: "10 Jul", text: "Transfer approved: AF-0056 from Rohan Iyer → Sana Qureshi", type: "transfer" },
  { date: "09 Jul", text: "AF-0037 returned by Sales Dept. — condition: Good", type: "return" },
  { date: "05 Jul", text: "AF-0178 re-allocated to Arjun Mehta (was Kiran Desai)", type: "allocate" },
  { date: "03 Jul", text: "AF-0001 overdue — expected return 03 Jul, still held by Priya Nair", type: "overdue" },
  { date: "01 Jul", text: "AF-0075 reserved for Logistics — return expected 20 Jul", type: "allocate" },
];

const HISTORY_HUE: Record<string, string> = {
  allocate: "var(--hue-teal)",
  return: "var(--verify)",
  transfer: "var(--hue-blue)",
  overdue: "var(--hue-coral)",
};

const STATUS_STYLE: Record<AssetStatus, { bg: string; fg: string }> = {
  Available: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  Allocated: { bg: "color-mix(in srgb, var(--accent) 14%, transparent)", fg: "var(--accent)" },
  Reserved: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  "Under Maintenance": { bg: "var(--hue-violet-soft)", fg: "var(--hue-violet)" },
};

const TRANSFER_STYLE: Record<TransferStatus, { bg: string; fg: string }> = {
  Requested: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
  Approved: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  "Re-allocated": { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  Rejected: { bg: "color-mix(in srgb, var(--hue-coral) 14%, transparent)", fg: "var(--hue-coral)" },
};

/* ── component ──────────────────────────────────────────────── */

export default function AllocationsPage() {
  const [selectedTag, setSelectedTag] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [transfers, setTransfers] = useState(TRANSFERS_INIT);
  const [history, setHistory] = useState(HISTORY);
  const [returnModalTag, setReturnModalTag] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnCondition, setReturnCondition] = useState("Good");

  const asset = ASSETS.find((a) => a.tag === selectedTag) ?? null;
  const isConflict = asset !== null && asset.status !== "Available";
  const canAllocate = asset !== null && asset.status === "Available";
  const returnAsset = returnModalTag ? ASSETS.find((a) => a.tag === returnModalTag) ?? null : null;

  /* pending transfers for the current view */
  const pendingTransfers = transfers.filter((t) => t.status === "Requested");

  function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !assignTo) return;
    const entry: HistoryEntry = {
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      text: `${asset.tag} allocated to ${assignTo}${returnDate ? ` — return expected ${returnDate}` : ""}`,
      type: "allocate",
    };
    setHistory((prev) => [entry, ...prev]);
    setSelectedTag("");
    setAssignTo("");
    setReturnDate("");
    setNotes("");
  }

  function handleTransferRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !assignTo) return;
    const t: Transfer = {
      id: transfers.length + 1,
      tag: asset.tag,
      asset: asset.name,
      from: asset.holder!,
      to: assignTo,
      status: "Requested",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      approver: null,
    };
    setTransfers((prev) => [t, ...prev]);
    const entry: HistoryEntry = {
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      text: `Transfer request: ${asset.tag} from ${asset.holder} → ${assignTo}`,
      type: "transfer",
    };
    setHistory((prev) => [entry, ...prev]);
    setSelectedTag("");
    setAssignTo("");
    setNotes("");
  }

  function handleApprove(id: number) {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "Approved" as TransferStatus, approver: CURRENT_USER.name } : t))
    );
    const t = transfers.find((tr) => tr.id === id);
    if (t) {
      setHistory((prev) => [
        {
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          text: `Transfer approved: ${t.tag} from ${t.from} → ${t.to}`,
          type: "transfer" as const,
        },
        ...prev,
      ]);
    }
  }

  function handleReject(id: number) {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "Rejected" as TransferStatus, approver: CURRENT_USER.name } : t))
    );
  }

  function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnAsset) return;
    const entry: HistoryEntry = {
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      text: `${returnAsset.tag} returned by ${returnAsset.holder} — condition: ${returnCondition}${returnNotes ? `. ${returnNotes}` : ""}`,
      type: "return",
    };
    setHistory((prev) => [entry, ...prev]);
    setReturnModalTag(null);
    setReturnNotes("");
    setReturnCondition("Good");
  }

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Assets</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Allocation &amp; Transfers</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Assign assets to employees or departments, request transfers, and process returns.
          </p>
        </div>
      </div>

      {/* ── main layout ─────────────────────────────── */}
      <div className="alloc-layout">
        {/* ── LEFT: allocate / transfer form ──────── */}
        <div>
          {/* asset selector */}
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>Select asset</h2>
          </div>
          <select
            value={selectedTag}
            onChange={(e) => { setSelectedTag(e.target.value); setAssignTo(""); setNotes(""); setReturnDate(""); }}
            className="alloc-select"
          >
            <option value="">— choose an asset —</option>
            {ASSETS.map((a) => (
              <option key={a.tag} value={a.tag}>
                {a.tag} · {a.name}
              </option>
            ))}
          </select>

          {/* ── asset info card ─────────────────────── */}
          {asset && (
            <div className="alloc-card">
              <div className="alloc-card-head">
                <div>
                  <span className="tag" style={{ fontSize: "14px" }}>{asset.tag}</span>
                  <span style={{ fontWeight: 700, marginLeft: 8, fontSize: "15px" }}>{asset.name}</span>
                </div>
                <span
                  className="chip"
                  style={{ background: STATUS_STYLE[asset.status].bg, color: STATUS_STYLE[asset.status].fg }}
                >
                  {asset.status}
                </span>
              </div>

              {/* conflict warning */}
              {isConflict && asset.holder && (
                <div className="alloc-conflict">
                  <div className="alloc-conflict-icon">!</div>
                  <div>
                    <strong>Already {asset.status.toLowerCase()}</strong> to {asset.holder}
                    {asset.holderDept && <span className="muted"> ({asset.holderDept})</span>}
                    {asset.overdue && (
                      <span className="chip chip-overdue" style={{ marginLeft: 8, fontSize: "9px", padding: "2px 7px" }}>
                        Overdue
                      </span>
                    )}
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--text-soft)" }}>
                      {asset.status === "Allocated"
                        ? "You can't double-allocate. Create a Transfer Request instead."
                        : asset.status === "Under Maintenance"
                          ? "This asset is currently under maintenance and cannot be allocated."
                          : "This asset is reserved. Create a Transfer Request to claim it."}
                    </p>
                  </div>
                </div>
              )}

              {/* ALLOCATE form — only for Available assets */}
              {canAllocate && (
                <form className="alloc-form" onSubmit={handleAllocate}>
                  <label className="setup-label">
                    Assign to <span className="req">*</span>
                    <select
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      className="setup-input"
                      required
                    >
                      <option value="">— select employee —</option>
                      {EMPLOYEES.map((emp) => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                  </label>
                  <label className="setup-label">
                    Expected return date
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="setup-input"
                    />
                    <span className="setup-hint">Leave empty for indefinite allocation. Overdue allocations are auto-flagged.</span>
                  </label>
                  <label className="setup-label">
                    Notes
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional allocation notes…"
                      rows={3}
                      className="setup-input"
                      style={{ resize: "vertical" }}
                    />
                  </label>
                  <div className="setup-actions">
                    <button type="submit" className="btn btn-accent">Allocate asset</button>
                  </div>
                </form>
              )}

              {/* TRANSFER REQUEST form — for already-held assets */}
              {isConflict && asset.status === "Allocated" && (
                <form className="alloc-form" onSubmit={handleTransferRequest}>
                  <label className="setup-label">
                    Transfer to <span className="req">*</span>
                    <select
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      className="setup-input"
                      required
                    >
                      <option value="">— select employee —</option>
                      {EMPLOYEES.filter((e) => e !== asset.holder).map((emp) => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                  </label>
                  <label className="setup-label">
                    Reason / notes
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Why is this transfer needed?"
                      rows={3}
                      className="setup-input"
                      style={{ resize: "vertical" }}
                    />
                  </label>
                  <div className="setup-actions">
                    <button type="submit" className="btn btn-accent">Create transfer request</button>
                  </div>
                </form>
              )}

              {/* Return button — for allocated assets */}
              {asset.status === "Allocated" && asset.holder && (
                <div style={{ padding: "0 18px 16px" }}>
                  <button
                    type="button"
                    className="qa-btn"
                    style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                    onClick={() => setReturnModalTag(asset.tag)}
                  >
                    Mark returned
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── pending transfers (approvals) ──────── */}
          {pendingTransfers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-head">
                <h2 style={{ color: "var(--hue-amber)" }}>Pending approvals</h2>
                <span className="count">{pendingTransfers.length} transfer{pendingTransfers.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="panel panel-warn" style={{ borderColor: "color-mix(in srgb, var(--hue-amber) 40%, var(--line))" }}>
                {pendingTransfers.map((t) => (
                  <div key={t.id} className="alloc-transfer-row">
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <span className="tag">{t.tag}</span>
                      <span style={{ fontWeight: 600, marginLeft: 6 }}>{t.asset}</span>
                      <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: 3 }}>
                        {t.from} → {t.to} · <span className="muted">{t.date}</span>
                      </div>
                    </div>
                    <div className="alloc-transfer-actions">
                      <button
                        type="button"
                        className="btn btn-accent"
                        style={{ padding: "6px 14px", fontSize: "12px" }}
                        onClick={() => handleApprove(t.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "6px 14px", fontSize: "12px" }}
                        onClick={() => handleReject(t.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: transfer log + history ──────── */}
        <div>
          {/* recent transfers */}
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>Transfer log</h2>
            <span className="count">{transfers.length} total</span>
          </div>
          <div className="panel">
            <div
              className="alloc-tlog-head"
            >
              <span>Asset</span>
              <span>From → To</span>
              <span>Status</span>
            </div>
            {transfers.map((t) => (
              <div key={t.id} className="alloc-tlog-row">
                <span>
                  <span className="tag">{t.tag}</span>
                </span>
                <span style={{ fontSize: "12px" }}>
                  {t.from} → {t.to}
                </span>
                <span
                  className="chip"
                  style={{ background: TRANSFER_STYLE[t.status].bg, color: TRANSFER_STYLE[t.status].fg, fontSize: "9.5px", padding: "2px 8px" }}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>

          {/* allocation history */}
          <div style={{ marginTop: 22 }}>
            <div className="section-head">
              <h2>Allocation history</h2>
              <span className="count">recent</span>
            </div>
            <div className="panel">
              {history.map((h, i) => (
                <div key={i} className="activity-item">
                  <span className="adot" style={{ ["--a-color" as string]: HISTORY_HUE[h.type] }} />
                  <span className="flex-1">{h.text}</span>
                  <span className="atime">{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RETURN MODAL ────────────────────────────── */}
      {returnAsset && (
        <div className="setup-overlay" onClick={() => setReturnModalTag(null)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Return asset</h2>
              <button type="button" className="setup-close" onClick={() => setReturnModalTag(null)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleReturn}>
              <div style={{ fontSize: "13.5px" }}>
                <span className="tag">{returnAsset.tag}</span>
                <span style={{ fontWeight: 600, marginLeft: 6 }}>{returnAsset.name}</span>
                <div style={{ marginTop: 4, fontSize: "12.5px", color: "var(--text-soft)" }}>
                  Currently held by <strong>{returnAsset.holder}</strong>
                </div>
              </div>
              <label className="setup-label">
                Condition on return <span className="req">*</span>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="setup-input"
                >
                  <option>New</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Needs Repair</option>
                  <option>Damaged</option>
                </select>
              </label>
              <label className="setup-label">
                Check-in notes
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Any observations on return…"
                  rows={3}
                  className="setup-input"
                  style={{ resize: "vertical" }}
                />
              </label>
              <div className="setup-actions">
                <button type="submit" className="btn btn-accent">Confirm return</button>
                <button type="button" className="btn btn-ghost" onClick={() => setReturnModalTag(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

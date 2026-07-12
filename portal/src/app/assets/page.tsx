"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

/* ── lifecycle statuses ─────────────────────────────────────── */

type Status = "Available" | "Allocated" | "Reserved" | "Under Maintenance" | "Lost" | "Retired" | "Disposed";

const STATUS_HUE: Record<Status, { bg: string; fg: string }> = {
  Available:         { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  Allocated:         { bg: "color-mix(in srgb, var(--accent) 14%, transparent)", fg: "var(--accent)" },
  Reserved:          { bg: "var(--hue-blue-soft)",   fg: "var(--hue-blue)" },
  "Under Maintenance": { bg: "var(--hue-violet-soft)", fg: "var(--hue-violet)" },
  Lost:              { bg: "color-mix(in srgb, var(--hue-coral) 16%, transparent)", fg: "var(--hue-coral)" },
  Retired:           { bg: "color-mix(in srgb, var(--muted) 16%, transparent)", fg: "var(--muted)" },
  Disposed:          { bg: "color-mix(in srgb, var(--muted) 10%, transparent)", fg: "var(--muted)" },
};

const ALL_STATUSES: Status[] = ["Available", "Allocated", "Reserved", "Under Maintenance", "Lost", "Retired", "Disposed"];

/* ── mock assets ────────────────────────────────────────────── */

interface Asset {
  id: number;
  tag: string;
  name: string;
  category: string;
  serial: string;
  status: Status;
  department: string;
  location: string;
  condition: string;
  acquired: string;
  cost: string;
  bookable: boolean;
  allocations: { to: string; from: string; until: string }[];
  maintenance: { date: string; issue: string; status: string }[];
}

const ASSETS: Asset[] = [
  {
    id: 1, tag: "AF-0001", name: "Dell Latitude 5440", category: "Electronics", serial: "SN-88213-A",
    status: "Allocated", department: "Engineering", location: "Bengaluru HQ, 3rd floor", condition: "Good",
    acquired: "12 Jan 2024", cost: "₹72,500", bookable: false,
    allocations: [
      { to: "Priya Nair", from: "15 Mar 2024", until: "—" },
      { to: "Rohan Iyer", from: "12 Jan 2024", until: "14 Mar 2024" },
    ],
    maintenance: [
      { date: "22 Jun 2024", issue: "Battery replacement", status: "Completed" },
    ],
  },
  {
    id: 2, tag: "AF-0037", name: "Canon Projector EX40", category: "Electronics", serial: "SN-40221-C",
    status: "Available", department: "Sales", location: "Bengaluru HQ, Conf. room B", condition: "Good",
    acquired: "08 Mar 2024", cost: "₹45,000", bookable: true,
    allocations: [
      { to: "Sales Dept.", from: "10 Mar 2024", until: "01 Jul 2025" },
    ],
    maintenance: [],
  },
  {
    id: 3, tag: "AF-0056", name: "Ergo Chair — Type B", category: "Furniture", serial: "FC-2288",
    status: "Allocated", department: "HR", location: "Bengaluru HQ, 2nd floor", condition: "Good",
    acquired: "20 Apr 2024", cost: "₹18,900", bookable: false,
    allocations: [
      { to: "Rohan Iyer", from: "22 Apr 2024", until: "—" },
    ],
    maintenance: [],
  },
  {
    id: 4, tag: "AF-0075", name: "Bajaj Pulsar (Fleet)", category: "Vehicles", serial: "KA-05-MN-4421",
    status: "Reserved", department: "Logistics", location: "Bengaluru HQ, Parking B", condition: "Fair",
    acquired: "14 Jun 2024", cost: "₹1,12,000", bookable: true,
    allocations: [
      { to: "Logistics", from: "14 Jun 2024", until: "—" },
    ],
    maintenance: [
      { date: "10 Jul 2025", issue: "Oil change + tyre check", status: "Scheduled" },
      { date: "04 Feb 2025", issue: "Front brake pad worn", status: "Completed" },
    ],
  },
  {
    id: 5, tag: "AF-0092", name: "Conference Room B2", category: "Real Estate", serial: "—",
    status: "Available", department: "—", location: "Bengaluru HQ, 4th floor", condition: "New",
    acquired: "01 Jan 2024", cost: "—", bookable: true,
    allocations: [],
    maintenance: [],
  },
  {
    id: 6, tag: "AF-0114", name: "MacBook Pro 14\"", category: "Electronics", serial: "SN-MBP14-0093",
    status: "Under Maintenance", department: "Engineering", location: "Service centre — Koramangala", condition: "Needs Repair",
    acquired: "28 Aug 2024", cost: "₹1,89,900", bookable: false,
    allocations: [
      { to: "Sana Qureshi", from: "01 Sep 2024", until: "—" },
    ],
    maintenance: [
      { date: "08 Jul 2025", issue: "Display flickering — sent for repair", status: "In progress" },
    ],
  },
  {
    id: 7, tag: "AF-0140", name: "HP LaserJet Pro MFP", category: "Electronics", serial: "SN-HP-7612",
    status: "Available", department: "HR", location: "Bengaluru HQ, 2nd floor", condition: "Good",
    acquired: "03 Oct 2024", cost: "₹32,400", bookable: true,
    allocations: [],
    maintenance: [
      { date: "01 Jun 2025", issue: "Toner replaced", status: "Completed" },
    ],
  },
  {
    id: 8, tag: "AF-0178", name: "Standing Desk — Adj.", category: "Furniture", serial: "FD-8814",
    status: "Allocated", department: "Engineering", location: "Bengaluru HQ, 3rd floor", condition: "New",
    acquired: "15 Nov 2024", cost: "₹24,500", bookable: false,
    allocations: [
      { to: "Arjun Mehta", from: "16 Nov 2024", until: "—" },
    ],
    maintenance: [],
  },
  {
    id: 9, tag: "AF-0201", name: "Calibration Gauge Set", category: "Equipment", serial: "EQ-4490",
    status: "Lost", department: "QA", location: "Last seen: Bengaluru HQ, Lab", condition: "—",
    acquired: "22 Dec 2024", cost: "₹8,600", bookable: false,
    allocations: [
      { to: "Meena Rao", from: "23 Dec 2024", until: "—" },
    ],
    maintenance: [],
  },
  {
    id: 10, tag: "AF-0220", name: "Acer Monitor 27\"", category: "Electronics", serial: "SN-ACR-2201",
    status: "Retired", department: "Sales", location: "Warehouse B", condition: "Fair",
    acquired: "10 Feb 2023", cost: "₹19,200", bookable: false,
    allocations: [
      { to: "Kiran Desai", from: "12 Feb 2023", until: "30 Sep 2024" },
    ],
    maintenance: [
      { date: "15 Sep 2024", issue: "Dead pixels — retired from service", status: "Completed" },
    ],
  },
];

const CATEGORIES = ["All", "Electronics", "Furniture", "Vehicles", "Equipment", "Real Estate"];
const DEPARTMENTS = ["All", "Engineering", "Sales", "HR", "QA", "Logistics"];
const LOCATIONS = ["All", "Bengaluru HQ, 2nd floor", "Bengaluru HQ, 3rd floor", "Bengaluru HQ, 4th floor", "Bengaluru HQ, Conf. room B", "Bengaluru HQ, Parking B", "Warehouse B"];

/* ── component ──────────────────────────────────────────────── */

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  /* filter logic */
  const filtered = ASSETS.filter((a) => {
    if (statusFilter !== "All" && a.status !== statusFilter) return false;
    if (categoryFilter !== "All" && a.category !== categoryFilter) return false;
    if (deptFilter !== "All" && a.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${a.tag} ${a.name} ${a.serial} ${a.category} ${a.department} ${a.location}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const selected = selectedId !== null ? ASSETS.find((a) => a.id === selectedId) ?? null : null;

  /* status counts for filter pills */
  const statusCounts: Record<string, number> = { All: ASSETS.length };
  ALL_STATUSES.forEach((s) => {
    statusCounts[s] = ASSETS.filter((a) => a.status === s).length;
  });

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Assets</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Asset directory</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Search, track, and manage every registered asset across the organization.
          </p>
        </div>
        <Link href="/assets/register" className="qa-btn primary">
          + Register asset
        </Link>
      </div>

      {/* ── search bar ──────────────────────────────────── */}
      <div className="asset-search-bar">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="asset-search-icon">
          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11L14.2 14.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tag, serial, name, or QR code…"
          className="asset-search-input"
        />
        {search && (
          <button
            type="button"
            className="asset-search-clear"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── filters row ─────────────────────────────────── */}
      <div className="asset-filters">
        <div className="asset-filter-group">
          <span className="asset-filter-label">Status</span>
          <div className="asset-filter-pills">
            {(["All", ...ALL_STATUSES] as const).map((s) => {
              const active = statusFilter === s;
              const hue = s === "All" ? null : STATUS_HUE[s];
              return (
                <button
                  key={s}
                  type="button"
                  className={`asset-pill ${active ? "active" : ""}`}
                  style={active && hue ? { background: hue.bg, color: hue.fg, borderColor: hue.fg } : undefined}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                  <span className="pill-n">{statusCounts[s] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="asset-dropdowns">
          <label className="asset-dropdown-label">
            Category
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="asset-dropdown"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="asset-dropdown-label">
            Department
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="asset-dropdown"
            >
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* ── results count ───────────────────────────────── */}
      <div className="section-head" style={{ marginTop: 4 }}>
        <h2>
          {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          {statusFilter !== "All" && <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {statusFilter}</span>}
        </h2>
        <span className="count">
          {categoryFilter !== "All" ? categoryFilter : "all categories"}
          {deptFilter !== "All" ? ` · ${deptFilter}` : ""}
        </span>
      </div>

      {/* ── main area: table + detail ───────────────────── */}
      <div className="asset-layout">
        {/* table */}
        <div className="panel" style={{ minWidth: 0 }}>
          <div
            className="asset-row asset-row-head"
          >
            <span>Tag</span>
            <span>Name</span>
            <span>Category</span>
            <span>Status</span>
            <span>Location</span>
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="es-icon">∅</div>
              No assets match your current filters.
            </div>
          )}

          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`asset-row ${selectedId === a.id ? "asset-row-selected" : ""}`}
              onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
            >
              <span className="tag">{a.tag}</span>
              <span style={{ fontWeight: 600 }}>{a.name}</span>
              <span className="muted">{a.category}</span>
              <span
                className="chip"
                style={{ background: STATUS_HUE[a.status].bg, color: STATUS_HUE[a.status].fg }}
              >
                {a.status}
              </span>
              <span className="muted" style={{ fontSize: "12px" }}>{a.location}</span>
            </button>
          ))}
        </div>

        {/* detail panel */}
        {selected && (
          <aside className="asset-detail">
            <div className="asset-detail-head">
              <div>
                <span className="tag" style={{ fontSize: "14px" }}>{selected.tag}</span>
                <h3 style={{ marginTop: 4, fontSize: "17px" }}>{selected.name}</h3>
              </div>
              <button
                type="button"
                className="setup-close"
                onClick={() => setSelectedId(null)}
                aria-label="Close detail"
              >
                ×
              </button>
            </div>

            <div className="asset-detail-body">
              {/* status badge */}
              <span
                className="chip"
                style={{
                  background: STATUS_HUE[selected.status].bg,
                  color: STATUS_HUE[selected.status].fg,
                  fontSize: "11px",
                  alignSelf: "flex-start",
                }}
              >
                {selected.status}
              </span>

              {/* properties */}
              <div className="asset-props">
                <div className="asset-prop">
                  <span className="pk">Category</span>
                  <span className="pv">{selected.category}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Serial</span>
                  <span className="pv" style={{ fontFamily: "ui-monospace, monospace" }}>{selected.serial}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Department</span>
                  <span className="pv">{selected.department}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Location</span>
                  <span className="pv">{selected.location}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Condition</span>
                  <span className="pv">{selected.condition}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Acquired</span>
                  <span className="pv">{selected.acquired}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Cost</span>
                  <span className="pv" style={{ fontFamily: "ui-monospace, monospace" }}>{selected.cost}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Bookable</span>
                  <span className="pv">{selected.bookable ? "Yes — shared resource" : "No"}</span>
                </div>
              </div>

              {/* allocation history */}
              <div style={{ marginTop: 18 }}>
                <div className="section-head">
                  <h2 style={{ fontSize: "13.5px" }}>Allocation history</h2>
                  <span className="count">{selected.allocations.length} record{selected.allocations.length !== 1 ? "s" : ""}</span>
                </div>
                {selected.allocations.length === 0 ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>
                    No allocation history for this asset.
                  </div>
                ) : (
                  <div className="panel">
                    {selected.allocations.map((al, i) => (
                      <div key={i} className="activity-item" style={{ fontSize: "12.5px", padding: "10px 12px" }}>
                        <span className="adot" style={{ ["--a-color" as string]: "var(--hue-amber)", marginTop: 4 }} />
                        <span className="flex-1">
                          <strong>{al.to}</strong>
                          <span className="muted" style={{ marginLeft: 6, fontSize: "11px" }}>{al.from} → {al.until}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* maintenance history */}
              <div style={{ marginTop: 14 }}>
                <div className="section-head">
                  <h2 style={{ fontSize: "13.5px" }}>Maintenance history</h2>
                  <span className="count">{selected.maintenance.length} record{selected.maintenance.length !== 1 ? "s" : ""}</span>
                </div>
                {selected.maintenance.length === 0 ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>
                    No maintenance records.
                  </div>
                ) : (
                  <div className="panel">
                    {selected.maintenance.map((m, i) => (
                      <div key={i} className="activity-item" style={{ fontSize: "12.5px", padding: "10px 12px" }}>
                        <span className="adot" style={{ ["--a-color" as string]: "var(--hue-violet)", marginTop: 4 }} />
                        <span className="flex-1">
                          <span>{m.issue}</span>
                          <span className="muted" style={{ marginLeft: 6, fontSize: "11px" }}>{m.date}</span>
                        </span>
                        <span
                          className="chip"
                          style={{
                            fontSize: "9px",
                            padding: "2px 7px",
                            background: m.status === "Completed"
                              ? "color-mix(in srgb, var(--verify) 14%, transparent)"
                              : m.status === "Scheduled"
                                ? "var(--hue-blue-soft)"
                                : "var(--hue-amber-soft)",
                            color: m.status === "Completed"
                              ? "var(--verify)"
                              : m.status === "Scheduled"
                                ? "var(--hue-blue)"
                                : "var(--hue-amber)",
                          }}
                        >
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}

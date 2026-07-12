"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

interface ActivityLog {
  id: number;
  category: "Allocation" | "Maintenance" | "Booking" | "Audit" | "System";
  actor: string;
  role: string;
  tag: string | null;
  text: string;
  time: string;
  timestamp: string;
  unread: boolean;
  ipAddress: string;
}

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 1,
    category: "Allocation",
    actor: "Arjun Mehta",
    role: "Asset Manager",
    tag: "AF-0114",
    text: "assigned Laptop AF-0114 to Priya Nair",
    time: "3m ago",
    timestamp: "12 Jul 2026, 03:56 PM",
    unread: true,
    ipAddress: "192.168.1.45",
  },
  {
    id: 2,
    category: "Maintenance",
    actor: "Arjun Mehta",
    role: "Asset Manager",
    tag: "AF-0056",
    text: "approved maintenance request for Projector AF-0056",
    time: "15m ago",
    timestamp: "12 Jul 2026, 03:44 PM",
    unread: true,
    ipAddress: "192.168.1.45",
  },
  {
    id: 3,
    category: "Booking",
    actor: "Design Team",
    role: "Employee",
    tag: "AF-0092",
    text: "confirmed booking for Conference Room B2 (02:00 PM – 03:00 PM)",
    time: "1h ago",
    timestamp: "12 Jul 2026, 02:59 PM",
    unread: false,
    ipAddress: "192.168.2.110",
  },
  {
    id: 4,
    category: "Allocation",
    actor: "Priya Nair",
    role: "Department Head",
    tag: "AF-0056",
    text: "approved asset transfer of AF-0056 to Facilities Department",
    time: "3h ago",
    timestamp: "12 Jul 2026, 01:10 PM",
    unread: false,
    ipAddress: "10.0.0.12",
  },
  {
    id: 5,
    category: "Allocation",
    actor: "System Sentinel",
    role: "Automated Bot",
    tag: "AF-0220",
    text: "flagged return of Monitor AF-0220 as Overdue (due 3 days ago)",
    time: "1d ago",
    timestamp: "11 Jul 2026, 09:00 AM",
    unread: true,
    ipAddress: "localhost",
  },
  {
    id: 6,
    category: "Audit",
    actor: "Ravi Shankar",
    role: "Auditor",
    tag: "AF-0098",
    text: "flagged discrepancy: Router AF-0098 marked as Damaged during Q3 cycle",
    time: "2d ago",
    timestamp: "10 Jul 2026, 04:30 PM",
    unread: false,
    ipAddress: "192.168.1.18",
  },
  {
    id: 7,
    category: "System",
    actor: "Arjun Mehta",
    role: "Admin",
    tag: null,
    text: "promoted Kiran Desai to Department Head of Sales",
    time: "3d ago",
    timestamp: "09 Jul 2026, 11:15 AM",
    unread: false,
    ipAddress: "192.168.1.45",
  },
  {
    id: 8,
    category: "Maintenance",
    actor: "Anjali Sharma",
    role: "Technician",
    tag: "AF-0205",
    text: "marked maintenance on Ergo Chair AF-0205 as Resolved",
    time: "6d ago",
    timestamp: "06 Jul 2026, 02:22 PM",
    unread: false,
    ipAddress: "192.168.4.12",
  },
];

const CATEGORY_COLOR: Record<ActivityLog["category"], string> = {
  Allocation: "var(--hue-teal)",
  Maintenance: "var(--hue-coral)",
  Booking: "var(--hue-blue)",
  Audit: "var(--hue-violet)",
  System: "var(--hue-amber)",
};

const CATEGORIES: ("All" | ActivityLog["category"])[] = ["All", "Allocation", "Maintenance", "Booking", "Audit", "System"];

/* Simulation log events list */
const SIMULATED_EVENTS = [
  { category: "Booking" as const, actor: "Sana Qureshi", role: "Employee", tag: "AF-0075", text: "booked Fleet Vehicle AF-0075 for tomorrow 10:00 AM", ipAddress: "192.168.1.88" },
  { category: "Maintenance" as const, actor: "Suresh Patel", role: "Technician", tag: "AF-0114", text: "started repair work on Laptop AF-0114", ipAddress: "192.168.4.10" },
  { category: "Allocation" as const, actor: "Meena Rao", role: "Department Head", tag: "AF-0140", text: "returned HP LaserJet Printer — condition: Good", ipAddress: "192.168.3.14" },
];

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>(INITIAL_LOGS);
  const [activeCategory, setActiveCategory] = useState<"All" | ActivityLog["category"]>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [liveStreamActive, setLiveStreamActive] = useState(false);

  /* Selected log object details */
  const selectedLog = selectedLogId !== null ? logs.find((l) => l.id === selectedLogId) ?? null : null;

  /* Live activity simulation stream */
  useEffect(() => {
    if (!liveStreamActive) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index >= SIMULATED_EVENTS.length) {
        setLiveStreamActive(false);
        return;
      }
      
      const seed = SIMULATED_EVENTS[index];
      const newLog: ActivityLog = {
        id: Date.now(),
        category: seed.category,
        actor: seed.actor,
        role: seed.role,
        tag: seed.tag,
        text: seed.text,
        time: "Just now",
        timestamp: new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        unread: true,
        ipAddress: seed.ipAddress,
      };

      setLogs((prev) => [newLog, ...prev]);
      index++;
    }, 4500);

    return () => clearInterval(interval);
  }, [liveStreamActive]);

  /* Mark all as read */
  function markAllRead() {
    setLogs((prev) => prev.map((l) => ({ ...l, unread: false })));
  }

  /* Clear all logs */
  function clearLogs() {
    setLogs([]);
    setSelectedLogId(null);
  }

  /* filter logs */
  const filteredLogs = logs.filter((l) => {
    if (activeCategory !== "All" && l.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${l.actor} ${l.role} ${l.tag ?? ""} ${l.text} ${l.timestamp}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const unreadCount = logs.filter((l) => l.unread).length;

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Audit Log</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Activity &amp; Notifications</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Real-time feed of allocation updates, maintenance approvals, bookings, and system audit logs.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            className={`qa-btn ${liveStreamActive ? "primary" : ""}`}
            onClick={() => setLiveStreamActive(!liveStreamActive)}
          >
            <span className={`pulse ${liveStreamActive ? "" : "bg-muted"}`} style={{ display: "inline-block", marginRight: 2 }} />
            {liveStreamActive ? "Live Streaming..." : "Simulate Live"}
          </button>
          <button type="button" className="qa-btn" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
      </div>

      {/* ── search bar ──────────────────────────────── */}
      <div className="asset-search-bar">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="asset-search-icon">
          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11L14.2 14.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter logs by actor, tag, date range or action details…"
          className="asset-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="asset-search-clear"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── filter categories tabs ──────────────────── */}
      <div className="setup-tabs-bar" style={{ margin: "14px 0 16px" }}>
        <div className="setup-tabs">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            const count = cat === "All" ? logs.length : logs.filter((l) => l.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                className={`setup-tab ${active ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
                style={{ padding: "8px 16px", fontSize: "12.5px" }}
              >
                {cat}
                <span className="tab-count">{count}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={clearLogs}
          className="btn btn-ghost font-mono"
          style={{ padding: "6px 12px", fontSize: "11px", color: "var(--hue-coral)" }}
        >
          Clear Log
        </button>
      </div>

      {/* ── results header ──────────────────────────── */}
      <div className="section-head">
        <h2>
          Activity Stream
          {unreadCount > 0 && (
            <span className="chip chip-overdue font-bold font-mono ml-2.5" style={{ fontSize: "9px", padding: "2px 7px" }}>
              {unreadCount} unread
            </span>
          )}
        </h2>
        <span className="count">
          Showing {filteredLogs.length} logs
        </span>
      </div>

      {/* ── main layouts split ──────────────────────── */}
      <div className="asset-layout" style={{ marginTop: 8 }}>
        {/* logs list */}
        <div className="panel" style={{ minWidth: 0 }}>
          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <div className="es-icon">∅</div>
              No activity logs recorded under this category filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const color = CATEGORY_COLOR[log.category];
              return (
                <button
                  key={log.id}
                  type="button"
                  className={`activity-feed-row ${selectedLogId === log.id ? "active" : ""} ${log.unread ? "unread" : ""}`}
                  onClick={() => {
                    setSelectedLogId(selectedLogId === log.id ? null : log.id);
                    // Mark single log as read on click
                    setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, unread: false } : l)));
                  }}
                >
                  <span className="adot" style={{ ["--a-color" as string]: color, alignSelf: "center" }} />
                  
                  {/* Category badge */}
                  <span className="log-category-badge" style={{ borderColor: color, color: color }}>
                    {log.category}
                  </span>

                  {/* text */}
                  <span className="log-text flex-1">
                    <strong>{log.actor}</strong> ({log.role}) {log.text}
                  </span>

                  {/* tag chip */}
                  {log.tag && (
                    <span className="tag" style={{ fontSize: "11px", alignSelf: "center" }}>
                      {log.tag}
                    </span>
                  )}

                  {/* relative timestamp */}
                  <span className="atime">{log.time}</span>
                </button>
              );
            })
          )}
        </div>

        {/* detail log panel sidebar */}
        {selectedLog && (
          <aside className="asset-detail" style={{ top: 80 }}>
            <div className="asset-detail-head">
              <div>
                <span className="tag" style={{ fontSize: "11.5px" }}>Log Details</span>
                <h3 style={{ marginTop: 4, fontSize: "15.5px" }}>Event Entry #{selectedLog.id.toString().slice(-6)}</h3>
              </div>
              <button
                type="button"
                className="setup-close"
                onClick={() => setSelectedLogId(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="asset-detail-body" style={{ gap: 14 }}>
              <div className="asset-props" style={{ marginTop: 0 }}>
                <div className="asset-prop">
                  <span className="pk">Category</span>
                  <span className="pv" style={{ color: CATEGORY_COLOR[selectedLog.category] }}>{selectedLog.category}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Action Time</span>
                  <span className="pv" style={{ fontSize: "11px" }}>{selectedLog.timestamp}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Triggered By</span>
                  <span className="pv">{selectedLog.actor}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Actor Role</span>
                  <span className="pv">{selectedLog.role}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Affected Asset</span>
                  <span className="pv">{selectedLog.tag || "— (System)"}</span>
                </div>
                <div className="asset-prop">
                  <span className="pk">Network IP</span>
                  <span className="pv font-mono" style={{ fontSize: "11px" }}>{selectedLog.ipAddress}</span>
                </div>
              </div>

              <div>
                <div className="section-head">
                  <h2 style={{ fontSize: "12.5px" }}>Full Action Description</h2>
                </div>
                <div className="panel p-3 bg-paper" style={{ fontSize: "13px", lineHeight: "1.45" }}>
                  <strong>{selectedLog.actor}</strong> ({selectedLog.role}) {selectedLog.text}.
                </div>
              </div>

              <div className="text-[11px] text-muted italic leading-relaxed">
                This log is part of the cryptographically locked audit trail. Event records are immutable once written to the system database ledger.
              </div>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}

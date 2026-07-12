"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const RESOURCES = [
  "Room B2 — Conference",
  "Room A1 — Huddle",
  "Projector — Cart 3",
  "Fleet Vehicle — KA01 AB 4521",
];

const RESOURCE_COLOR: Record<string, { main: string; soft: string }> = {
  "Room B2 — Conference": { main: "var(--hue-blue)", soft: "var(--hue-blue-soft)" },
  "Room A1 — Huddle": { main: "var(--hue-teal)", soft: "var(--hue-teal-soft)" },
  "Projector — Cart 3": { main: "var(--hue-violet)", soft: "var(--hue-violet-soft)" },
  "Fleet Vehicle — KA01 AB 4521": { main: "var(--hue-coral)", soft: "var(--hue-coral-soft)" },
};

interface Booking {
  id: number;
  resource: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  purpose: string;
  by: string;
  status: "Confirmed" | "Requested" | "Cancelled";
}

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 1,
    resource: "Room B2 — Conference",
    date: "2026-07-12",
    startTime: "09:00",
    endTime: "10:30",
    purpose: "Procurement Quarterly Review",
    by: "Procurement Team",
    status: "Confirmed",
  },
  {
    id: 2,
    resource: "Room B2 — Conference",
    date: "2026-07-12",
    startTime: "13:00",
    endTime: "14:30",
    purpose: "Sales Pitch Prep",
    by: "Priya Nair",
    status: "Confirmed",
  },
  {
    id: 3,
    resource: "Room A1 — Huddle",
    date: "2026-07-12",
    startTime: "11:00",
    endTime: "12:00",
    purpose: "Backend Sync",
    by: "Sana Qureshi",
    status: "Confirmed",
  },
  {
    id: 4,
    resource: "Projector — Cart 3",
    date: "2026-07-12",
    startTime: "14:00",
    endTime: "16:00",
    purpose: "Vendor Demo Session",
    by: "Meena Rao",
    status: "Confirmed",
  },
  {
    id: 5,
    resource: "Room B2 — Conference",
    date: "2026-07-13",
    startTime: "10:00",
    endTime: "11:30",
    purpose: "System Architecture Design",
    by: "Ravi Shankar",
    status: "Confirmed",
  },
  {
    id: 6,
    resource: "Fleet Vehicle — KA01 AB 4521",
    date: "2026-07-15",
    startTime: "09:30",
    endTime: "17:00",
    purpose: "Client site visits (Whitefield)",
    by: "Tarun Bhat",
    status: "Confirmed",
  },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9:00 to 20:00

/* ── helpers ────────────────────────────────────────────────── */

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeAMPM(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${padZero(m)} ${ampm}`;
}

function getMonthGrid(cursor: Date): Date[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay(); // 0 = Sun, 1 = Mon
  let paddingDays = startDay === 0 ? 6 : startDay - 1;

  const gridStart = new Date(year, month, 1 - paddingDays);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function BookingsPage() {
  const [cursor, setCursor] = useState(new Date(2026, 6, 12)); // July 12, 2026
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedResource, setSelectedResource] = useState<string>("All");
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);

  /* modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingResource, setBookingResource] = useState(RESOURCES[0]);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStart, setBookingStart] = useState("09:00");
  const [bookingEnd, setBookingEnd] = useState("10:00");
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [bookingBy, setBookingBy] = useState("Arjun Mehta");

  /* filter bookings */
  const filteredBookings = bookings.filter((b) => {
    if (selectedResource !== "All" && b.resource !== selectedResource) return false;
    return true;
  });

  const monthGrid = getMonthGrid(cursor);

  /* current month text */
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthLabel = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;

  /* check for booking overlap */
  const checkOverlap = (
    resource: string,
    date: string,
    start: string,
    end: string
  ): Booking | null => {
    const startMins = parseTime(start);
    const endMins = parseTime(end);

    for (const b of bookings) {
      if (b.resource === resource && b.date === date && b.status !== "Cancelled") {
        const bStart = parseTime(b.startTime);
        const bEnd = parseTime(b.endTime);

        if (startMins < bEnd && endMins > bStart) {
          return b;
        }
      }
    }
    return null;
  };

  const conflict = checkOverlap(bookingResource, bookingDate, bookingStart, bookingEnd);

  function handlePrev() {
    const nextCursor = new Date(cursor);
    if (viewMode === "month") {
      nextCursor.setMonth(cursor.getMonth() - 1);
    } else {
      nextCursor.setDate(cursor.getDate() - 1);
    }
    setCursor(nextCursor);
  }

  function handleNext() {
    const nextCursor = new Date(cursor);
    if (viewMode === "month") {
      nextCursor.setMonth(cursor.getMonth() + 1);
    } else {
      nextCursor.setDate(cursor.getDate() + 1);
    }
    setCursor(nextCursor);
  }

  function handleToday() {
    setCursor(new Date(2026, 6, 12));
  }

  function openNewBooking(dateStr: string, timeStr?: string) {
    setBookingResource(selectedResource !== "All" ? selectedResource : RESOURCES[0]);
    setBookingDate(dateStr);
    if (timeStr) {
      setBookingStart(timeStr);
      const [h, m] = timeStr.split(":").map(Number);
      setBookingEnd(`${padZero(h + 1)}:${padZero(m)}`);
    } else {
      setBookingStart("09:00");
      setBookingEnd("10:00");
    }
    setBookingPurpose("");
    setBookingBy("Arjun Mehta");
    setModalOpen(true);
  }

  function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (conflict) return;

    const newBooking: Booking = {
      id: bookings.length + 1,
      resource: bookingResource,
      date: bookingDate,
      startTime: bookingStart,
      endTime: bookingEnd,
      purpose: bookingPurpose.trim() || "Team sync",
      by: bookingBy.trim(),
      status: "Confirmed",
    };

    setBookings((prev) => [...prev, newBooking]);
    setModalOpen(false);
  }

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Bookings</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Resource booking</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Time-slot booking for rooms, vehicles, and equipment with automatic overlap validation.
          </p>
        </div>
        <button
          type="button"
          className="qa-btn primary"
          onClick={() => openNewBooking(formatDateISO(cursor))}
        >
          + Book slot
        </button>
      </div>

      {/* ── toolbar filters ────────────────────────── */}
      <div className="booking-toolbar">
        {/* resource selector */}
        <label className="asset-dropdown-label">
          Resource:
          <select
            value={selectedResource}
            onChange={(e) => setSelectedResource(e.target.value)}
            className="asset-dropdown"
          >
            <option value="All">All Resources</option>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        {/* nav and switcher */}
        <div className="booking-nav-actions">
          <div className="setup-tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={`setup-tab ${viewMode === "month" ? "active" : ""}`}
              onClick={() => setViewMode("month")}
              style={{ padding: "8px 14px", fontSize: "12.5px" }}
            >
              Month
            </button>
            <button
              type="button"
              className={`setup-tab ${viewMode === "day" ? "active" : ""}`}
              onClick={() => setViewMode("day")}
              style={{ padding: "8px 14px", fontSize: "12.5px" }}
            >
              Day
            </button>
          </div>

          <div className="booking-calendar-nav">
            <button type="button" className="booking-nav-btn" onClick={handlePrev}>
              ←
            </button>
            <button type="button" className="booking-nav-btn font-mono" onClick={handleToday} style={{ fontSize: "11px" }}>
              Today
            </button>
            <button type="button" className="booking-nav-btn" onClick={handleNext}>
              →
            </button>
          </div>
          <span className="booking-current-label">{viewMode === "month" ? currentMonthLabel : cursor.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* ── MONTH VIEW ──────────────────────────────── */}
      {viewMode === "month" && (
        <div className="panel" style={{ marginTop: 10 }}>
          <div className="grid grid-cols-7 border-b border-line bg-paper-raised">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((day, index) => {
              const dayStr = formatDateISO(day);
              const dayEvents = filteredBookings.filter((b) => b.date === dayStr);
              const inMonth = day.getMonth() === cursor.getMonth();
              const today = day.getDate() === 12 && day.getMonth() === 6 && day.getFullYear() === 2026; // Seeding Today to match local timestamp year/month

              return (
                <div
                  key={index}
                  onClick={() => {
                    setCursor(day);
                    setViewMode("day");
                  }}
                  className="min-h-[100px] border-b border-r border-line p-2 hover:bg-paper-raised cursor-pointer transition-colors relative"
                  style={{
                    background: inMonth ? "var(--card)" : "var(--paper)",
                  }}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-ink text-paper font-bold" : inMonth ? "text-text" : "text-muted"}`}
                  >
                    {day.getDate()}
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const color = RESOURCE_COLOR[e.resource]?.main || "var(--hue-blue)";
                      const soft = RESOURCE_COLOR[e.resource]?.soft || "var(--hue-blue-soft)";
                      return (
                        <div
                          key={e.id}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setCursor(day);
                            setViewMode("day");
                          }}
                          className="booking-mini-chip"
                          style={{
                            borderLeft: `2.5px solid ${color}`,
                            background: soft,
                          }}
                        >
                          <span className="font-semibold">{e.startTime}</span> {e.purpose}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] font-bold text-accent px-1.5">
                        +{dayEvents.length - 3} more slots
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DAY VIEW ────────────────────────────────── */}
      {viewMode === "day" && (
        <div className="booking-day-layout" style={{ marginTop: 10 }}>
          {/* Timeline side */}
          <div className="panel" style={{ overflow: "hidden", position: "relative" }}>
            <div className="booking-timeline-header">
              <span className="time-lbl">Time</span>
              <span className="booking-cell-title">Allocated Time Slots</span>
            </div>

            <div className="relative" style={{ height: HOURS.length * 60 }}>
              {/* Hour Grid Lines */}
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  onClick={() => openNewBooking(formatDateISO(cursor), `${padZero(h)}:00`)}
                  className="absolute left-0 right-0 flex border-t border-line hover:bg-paper-raised cursor-crosshair transition-colors"
                  style={{
                    top: i * 60,
                    height: 60,
                  }}
                >
                  <div className="w-16 shrink-0 px-3 py-1 font-mono text-xs text-muted text-right select-none">
                    {padZero(h)}:00
                  </div>
                </div>
              ))}

              {/* Lunch hour marker (13:30 - 14:30) */}
              <div
                className="absolute left-16 right-0 booking-lunch-strip"
                style={{
                  top: 4.5 * 60, // 9:00 to 13:30 is 4.5 hours
                  height: 60, // 1 hour duration
                }}
                title="Lunch Break"
              >
                <span className="lunch-txt">LUNCH HOUR (RESOURCE COOLDOWN)</span>
              </div>

              {/* Bookings overlays */}
              <div className="absolute left-16 right-3 top-0 bottom-0 pointer-events-none">
                {filteredBookings
                  .filter((b) => b.date === formatDateISO(cursor))
                  .map((b) => {
                    const startMins = parseTime(b.startTime);
                    const endMins = parseTime(b.endTime);

                    const top = ((startMins - 9 * 60) / 60) * 60;
                    const height = ((endMins - startMins) / 60) * 60;

                    const color = RESOURCE_COLOR[b.resource]?.main || "var(--hue-blue)";
                    const soft = RESOURCE_COLOR[b.resource]?.soft || "var(--hue-blue-soft)";

                    return (
                      <div
                        key={b.id}
                        className="absolute booking-overlay-card pointer-events-auto"
                        style={{
                          top: top + 2,
                          height: height - 4,
                          borderLeft: `4px solid ${color}`,
                          background: soft,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="time font-bold">
                            {formatTimeAMPM(b.startTime)} – {formatTimeAMPM(b.endTime)}
                          </span>
                          <span className="chip" style={{ fontSize: "9px", padding: "1px 6px", background: "var(--paper-raised)" }}>
                            {b.resource.split(" — ")[0]}
                          </span>
                        </div>
                        <div className="purpose mt-1 font-semibold">{b.purpose}</div>
                        <div className="by mt-0.5 text-muted">Booked by {b.by}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Quick info panel */}
          <aside className="booking-info-aside">
            <div className="section-head">
              <h2>Select Resource to View</h2>
            </div>
            <div className="panel flex flex-col gap-2 p-3">
              {RESOURCES.map((r) => {
                const color = RESOURCE_COLOR[r]?.main || "var(--hue-blue)";
                const count = bookings.filter((b) => b.resource === r && b.date === formatDateISO(cursor)).length;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedResource(r)}
                    className={`booking-res-selector-btn ${selectedResource === r ? "active" : ""}`}
                    style={{ ["--res-color" as string]: color }}
                  >
                    <span className="btn-res-dot" />
                    <span className="flex-1 text-left truncate">{r}</span>
                    <span className="tab-count" style={{ background: "var(--paper-raised)" }}>{count}</span>
                  </button>
                );
              })}
              {selectedResource !== "All" && (
                <button
                  type="button"
                  onClick={() => setSelectedResource("All")}
                  className="qa-btn"
                  style={{ width: "100%", justifyContent: "center", fontSize: "12px", marginTop: 4 }}
                >
                  View All Resources
                </button>
              )}
            </div>

            <div className="mt-6">
              <div className="section-head">
                <h2>Legend</h2>
              </div>
              <div className="panel p-3.5 flex flex-col gap-2.5" style={{ fontSize: "12.5px" }}>
                {RESOURCES.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: RESOURCE_COLOR[r]?.main }} />
                    <span className="text-text-soft">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── NEW BOOKING MODAL ────────────────────────── */}
      {modalOpen && (
        <div className="setup-overlay" onClick={() => setModalOpen(false)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Book Slot</h2>
              <button type="button" className="setup-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleCreateBooking}>
              <label className="setup-label">
                Resource <span className="req">*</span>
                <select
                  value={bookingResource}
                  onChange={(e) => setBookingResource(e.target.value)}
                  className="setup-input"
                  required
                >
                  {RESOURCES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>

              <label className="setup-label">
                Date <span className="req">*</span>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="setup-input"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="setup-label">
                  Start time <span className="req">*</span>
                  <input
                    type="time"
                    value={bookingStart}
                    onChange={(e) => setBookingStart(e.target.value)}
                    className="setup-input"
                    required
                  />
                </label>
                <label className="setup-label">
                  End time <span className="req">*</span>
                  <input
                    type="time"
                    value={bookingEnd}
                    onChange={(e) => setBookingEnd(e.target.value)}
                    className="setup-input"
                    required
                  />
                </label>
              </div>

              {/* Conflict banner */}
              {conflict && (
                <div className="alloc-conflict" style={{ margin: "4px 0" }}>
                  <div className="alloc-conflict-icon">!</div>
                  <div style={{ fontSize: "13px" }}>
                    <strong>Booking conflict detected:</strong>
                    <p style={{ margin: "2px 0 0", color: "var(--text-soft)" }}>
                      Slot is already reserved by <strong>{conflict.by}</strong> for <em>&ldquo;{conflict.purpose}&rdquo;</em> ({conflict.startTime} – {conflict.endTime}).
                    </p>
                  </div>
                </div>
              )}

              <label className="setup-label">
                Purpose / notes <span className="req">*</span>
                <textarea
                  value={bookingPurpose}
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  placeholder="What is this booking for?"
                  rows={3}
                  className="setup-input"
                  style={{ resize: "vertical" }}
                  required
                />
              </label>

              <label className="setup-label">
                Booked by <span className="req">*</span>
                <input
                  type="text"
                  value={bookingBy}
                  onChange={(e) => setBookingBy(e.target.value)}
                  className="setup-input"
                  required
                />
              </label>

              <div className="setup-actions">
                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={!!conflict}
                  style={conflict ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  Confirm Booking
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

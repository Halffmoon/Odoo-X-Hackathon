"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { notificationsApi, logsApi } from "@/lib/api/notifications";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityPage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const canSeeLogs = hasRole("ADMIN", "ASSET_MANAGER");
  const [tab, setTab] = useState<"notifications" | "logs">("notifications");

  const notifState = useApi((s) => notificationsApi.list({ limit: 100 }, s));
  const logsState = useApi(
    (s) => (canSeeLogs ? logsApi.list({ limit: 100 }, s) : Promise.resolve([])),
    [canSeeLogs],
  );

  const notifs = notifState.data?.items ?? [];
  const unread = notifState.data?.unread_count ?? 0;
  const logs = logsState.data ?? [];

  async function markRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      notifState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed.");
    }
  }

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      success("All marked read.");
      notifState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed.");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Activity</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Notifications &amp; activity</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Your alerts and the organization&apos;s audit trail.</p>
        </div>
        {tab === "notifications" && unread > 0 && (
          <button className="qa-btn" onClick={markAll}>Mark all read ({unread})</button>
        )}
      </div>

      <div className="setup-tabs-bar">
        <div className="setup-tabs">
          <button className={`setup-tab ${tab === "notifications" ? "active" : ""}`} onClick={() => setTab("notifications")}>
            Notifications <span className="tab-count">{unread}</span>
          </button>
          {canSeeLogs && (
            <button className={`setup-tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
              Activity log <span className="tab-count">{logs.length}</span>
            </button>
          )}
        </div>
      </div>

      {tab === "notifications" && (
        <div className="panel">
          {notifState.loading ? (
            <div className="activity-item"><span className="muted">Loading…</span></div>
          ) : notifs.length === 0 ? (
            <div className="empty-state"><div className="es-icon">∅</div>No notifications.</div>
          ) : (
            notifs.map((n) => (
              <div key={n.notification_id} className="activity-item" style={{ opacity: n.is_read ? 0.6 : 1 }}>
                <span className="adot" style={{ ["--a-color" as string]: n.is_read ? "var(--muted)" : "var(--hue-blue)" }} />
                <span className="flex-1">
                  <strong style={{ fontSize: "13px" }}>{n.title}</strong>
                  <span className="block muted" style={{ fontSize: "12px" }}>{n.message}</span>
                </span>
                <span className="atime">{fmt(n.created_on)}</span>
                {!n.is_read && (
                  <button className="text-[11px] text-accent underline ml-2" onClick={() => markRead(n.notification_id)}>Mark read</button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "logs" && canSeeLogs && (
        <div className="panel">
          {logsState.loading ? (
            <div className="activity-item"><span className="muted">Loading…</span></div>
          ) : logs.length === 0 ? (
            <div className="empty-state"><div className="es-icon">∅</div>No activity recorded.</div>
          ) : (
            logs.map((l) => (
              <div key={l.log_id} className="activity-item">
                <span className="adot" style={{ ["--a-color" as string]: "var(--hue-violet)" }} />
                <span className="flex-1">
                  <strong style={{ fontSize: "12.5px" }}>{l.action}</strong>
                  <span className="muted" style={{ marginLeft: 6, fontSize: "11.5px" }}>
                    {l.actor_name ?? "system"}{l.entity_table ? ` · ${l.entity_table}` : ""}
                  </span>
                </span>
                <span className="atime">{fmt(l.created_on)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}

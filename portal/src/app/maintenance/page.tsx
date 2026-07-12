"use client";

import { useState } from "react";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { employeesApi, type Employee } from "@/lib/api/employees";
import {
  maintenanceApi,
  MAINT_STATUS_LABEL,
  MAINT_STATUS_STYLE,
  PRIORITY_STYLE,
  type Maintenance,
  type MaintenanceStatus,
} from "@/lib/api/maintenance";

const COLUMNS: { key: MaintenanceStatus; title: string }[] = [
  { key: "PENDING", title: "Pending approval" },
  { key: "APPROVED", title: "Approved" },
  { key: "TECHNICIAN_ASSIGNED", title: "Tech assigned" },
  { key: "IN_PROGRESS", title: "In progress" },
  { key: "RESOLVED", title: "Resolved" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Card({
  m,
  canManage,
  technicians,
  onAction,
}: {
  m: Maintenance;
  canManage: boolean;
  technicians: Employee[];
  onAction: (fn: () => Promise<unknown>, msg: string) => void;
}) {
  const [techId, setTechId] = useState("");
  return (
    <div className="panel" style={{ padding: "12px 14px" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="tag">{m.asset_tag}</span>
        <span className="chip" style={{ background: PRIORITY_STYLE[m.priority].bg, color: PRIORITY_STYLE[m.priority].fg, fontSize: "9px", padding: "2px 7px" }}>{m.priority}</span>
      </div>
      <p style={{ margin: "8px 0 4px", fontSize: "12.5px" }}>{m.issue_description}</p>
      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
        {m.requester_name ?? "—"} · {fmt(m.created_on)}
        {m.technician_name && <> · tech: {m.technician_name}</>}
      </div>
      <span className="chip" style={{ marginTop: 6, display: "inline-block", background: MAINT_STATUS_STYLE[m.status].bg, color: MAINT_STATUS_STYLE[m.status].fg, fontSize: "9px", padding: "2px 7px" }}>
        {MAINT_STATUS_LABEL[m.status]}
      </span>

      {m.status === "PENDING" && canManage && (
        <div className="flex gap-2 mt-2">
          <button className="btn btn-accent" style={{ padding: "4px 12px", fontSize: "11.5px" }} onClick={() => onAction(() => maintenanceApi.approve(m.maintenance_id), "Approved.")}>Approve</button>
          <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: "11.5px" }} onClick={() => onAction(() => maintenanceApi.reject(m.maintenance_id), "Rejected.")}>Reject</button>
        </div>
      )}
      {m.status === "APPROVED" && canManage && (
        <div className="flex gap-2 mt-2">
          <select value={techId} onChange={(e) => setTechId(e.target.value)} className="setup-input" style={{ padding: "4px 8px", fontSize: "11.5px" }}>
            <option value="">Technician…</option>
            {technicians.map((t) => <option key={t.employee_id} value={t.employee_id}>{t.name}</option>)}
          </select>
          <button className="btn btn-accent" style={{ padding: "4px 12px", fontSize: "11.5px" }} disabled={!techId} onClick={() => onAction(() => maintenanceApi.assignTechnician(m.maintenance_id, techId), "Technician assigned.")}>Assign</button>
        </div>
      )}
      {m.status === "TECHNICIAN_ASSIGNED" && (
        <button className="btn btn-accent mt-2" style={{ padding: "4px 12px", fontSize: "11.5px" }} onClick={() => onAction(() => maintenanceApi.start(m.maintenance_id), "Work started.")}>Start work</button>
      )}
      {m.status === "IN_PROGRESS" && (
        <button className="btn btn-accent mt-2" style={{ padding: "4px 12px", fontSize: "11.5px" }} onClick={() => onAction(() => maintenanceApi.resolve(m.maintenance_id), "Resolved.")}>Mark resolved</button>
      )}
    </div>
  );
}

export default function MaintenancePage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const canManage = hasRole("ADMIN", "ASSET_MANAGER");

  const listState = useApi((s) => maintenanceApi.list({ page_size: 200 }, s));
  const techState = useApi((s) => employeesApi.list({ status: "ACTIVE" }, s));
  const items = listState.data?.items ?? [];
  const technicians = techState.data ?? [];

  async function onAction(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      success(msg);
      listState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Action failed.");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Maintenance</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Maintenance workflow</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">Track repair requests from report through approval, assignment, and resolution.</p>
        </div>
        <Link href="/maintenance/new" className="qa-btn primary">+ Raise request</Link>
      </div>

      {listState.loading ? (
        <div className="empty-state" style={{ marginTop: 24 }}>Loading requests…</div>
      ) : listState.error ? (
        <div className="empty-state" style={{ marginTop: 24 }}>{listState.error} <button className="underline" onClick={listState.refetch}>Retry</button></div>
      ) : (
        <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {COLUMNS.map((col) => {
            const colItems = items.filter((m) => m.status === col.key);
            return (
              <div key={col.key}>
                <div className="section-head">
                  <h2 style={{ fontSize: "13px" }}>{col.title}</h2>
                  <span className="count">{colItems.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {colItems.length === 0 ? (
                    <div className="panel" style={{ padding: "14px", fontSize: "12px", color: "var(--muted)" }}>—</div>
                  ) : (
                    colItems.map((m) => (
                      <Card key={m.maintenance_id} m={m} canManage={canManage} technicians={technicians} onAction={onAction} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

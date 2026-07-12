"use client";

import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { assetsApi, ASSET_STATUS_HUE, ASSET_STATUS_LABEL, type AssetCondition } from "@/lib/api/assets";
import { employeesApi } from "@/lib/api/employees";
import { allocationsApi } from "@/lib/api/allocations";
import {
  transfersApi,
  TRANSFER_STATUS_LABEL,
  TRANSFER_STATUS_STYLE,
} from "@/lib/api/transfers";

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AllocationsPage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const canManage = hasRole("ADMIN", "ASSET_MANAGER", "DEPT_HEAD");
  const canApprove = canManage;

  const assetsState = useApi((s) => assetsApi.list({ page_size: 200 }, s));
  const employeesState = useApi((s) => employeesApi.list({ status: "ACTIVE" }, s));
  const transfersState = useApi((s) => transfersApi.list({ page_size: 100 }, s));
  const recentAllocState = useApi((s) => allocationsApi.list({ page_size: 12 }, s));

  const assets = assetsState.data?.items ?? [];
  const employees = employeesState.data ?? [];
  const transfers = transfersState.data?.items ?? [];
  const recentAllocs = recentAllocState.data?.items ?? [];

  const [selectedId, setSelectedId] = useState("");
  const asset = assets.find((a) => a.asset_id === selectedId) ?? null;

  // Active allocation for the selected asset (to enable returns / show holder).
  const activeAllocState = useApi(
    (s) =>
      asset && asset.status !== "AVAILABLE"
        ? allocationsApi.list({ asset_id: asset.asset_id, status: "ACTIVE", page_size: 1 }, s)
        : Promise.resolve(null),
    [asset?.asset_id, asset?.status],
  );
  const activeAlloc = activeAllocState.data?.items?.[0] ?? null;

  const [assignTo, setAssignTo] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnCondition, setReturnCondition] = useState<AssetCondition>("GOOD");
  const [returnNotes, setReturnNotes] = useState("");

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => t.status === "REQUESTED"),
    [transfers],
  );

  function resetForms() {
    setAssignTo("");
    setReturnDate("");
    setTransferTo("");
    setRemarks("");
  }

  function refetchAll() {
    assetsState.refetch();
    transfersState.refetch();
    recentAllocState.refetch();
    activeAllocState.refetch();
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !assignTo) return;
    setSubmitting(true);
    try {
      await allocationsApi.create({
        asset_id: asset.asset_id,
        employee_id: assignTo,
        expected_return_date: returnDate || null,
      });
      success(`${asset.asset_tag} allocated.`);
      resetForms();
      setSelectedId("");
      refetchAll();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toastError("This asset is already allocated. Request a transfer instead.");
      } else {
        toastError(err instanceof ApiError ? err.message : "Failed to allocate.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransferRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !transferTo) return;
    setSubmitting(true);
    try {
      await transfersApi.create({
        asset_id: asset.asset_id,
        to_employee_id: transferTo,
        remarks: remarks || null,
      });
      success("Transfer request created.");
      resetForms();
      transfersState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to request transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await transfersApi.approve(id);
      success("Transfer approved.");
      refetchAll();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to approve.");
    }
  }

  async function handleReject(id: string) {
    try {
      await transfersApi.reject(id);
      success("Transfer rejected.");
      transfersState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to reject.");
    }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAlloc) return;
    setSubmitting(true);
    try {
      await allocationsApi.return(activeAlloc.allocation_id, returnCondition, returnNotes || undefined);
      success(`${asset?.asset_tag} marked returned.`);
      setReturnOpen(false);
      setReturnNotes("");
      setReturnCondition("GOOD");
      setSelectedId("");
      refetchAll();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to process return.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Assets</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Allocation &amp; Transfers</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Assign assets to employees, request transfers, and process returns.
          </p>
        </div>
      </div>

      <div className="alloc-layout">
        <div>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>Select asset</h2>
          </div>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); resetForms(); }}
            className="alloc-select"
          >
            <option value="">{assetsState.loading ? "Loading assets…" : "— choose an asset —"}</option>
            {assets.map((a) => (
              <option key={a.asset_id} value={a.asset_id}>{a.asset_tag} · {a.name}</option>
            ))}
          </select>

          {asset && (
            <div className="alloc-card">
              <div className="alloc-card-head">
                <div>
                  <span className="tag" style={{ fontSize: "14px" }}>{asset.asset_tag}</span>
                  <span style={{ fontWeight: 700, marginLeft: 8, fontSize: "15px" }}>{asset.name}</span>
                </div>
                <span className="chip" style={{ background: ASSET_STATUS_HUE[asset.status].bg, color: ASSET_STATUS_HUE[asset.status].fg }}>
                  {ASSET_STATUS_LABEL[asset.status]}
                </span>
              </div>

              {asset.status !== "AVAILABLE" && (
                <div className="alloc-conflict">
                  <div className="alloc-conflict-icon">!</div>
                  <div>
                    <strong>Currently {ASSET_STATUS_LABEL[asset.status].toLowerCase()}</strong>
                    {activeAlloc?.employee_name && <span> to {activeAlloc.employee_name}</span>}
                    {activeAlloc?.days_overdue ? (
                      <span className="chip chip-overdue" style={{ marginLeft: 8, fontSize: "9px", padding: "2px 7px" }}>
                        {activeAlloc.days_overdue}d overdue
                      </span>
                    ) : null}
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--text-soft)" }}>
                      {asset.status === "ALLOCATED"
                        ? "You can't double-allocate. Create a transfer request instead."
                        : asset.status === "UNDER_MAINTENANCE"
                          ? "This asset is under maintenance and cannot be allocated."
                          : "This asset is not available for allocation."}
                    </p>
                  </div>
                </div>
              )}

              {asset.status === "AVAILABLE" && canManage && (
                <form className="alloc-form" onSubmit={handleAllocate}>
                  <label className="setup-label">
                    Assign to <span className="req">*</span>
                    <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="setup-input" required>
                      <option value="">— select employee —</option>
                      {employees.map((emp) => <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>)}
                    </select>
                  </label>
                  <label className="setup-label">
                    Expected return date
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="setup-input" />
                    <span className="setup-hint">Leave empty for indefinite allocation. Overdue allocations are auto-flagged.</span>
                  </label>
                  <div className="setup-actions">
                    <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Allocating…" : "Allocate asset"}</button>
                  </div>
                </form>
              )}

              {asset.status === "AVAILABLE" && !canManage && (
                <div style={{ padding: "0 18px 16px", fontSize: "12.5px", color: "var(--text-soft)" }}>
                  Only Asset Managers and Department Heads can allocate assets.
                </div>
              )}

              {asset.status === "ALLOCATED" && (
                <form className="alloc-form" onSubmit={handleTransferRequest}>
                  <label className="setup-label">
                    Transfer to <span className="req">*</span>
                    <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="setup-input" required>
                      <option value="">— select employee —</option>
                      {employees
                        .filter((e) => e.employee_id !== activeAlloc?.employee_id)
                        .map((emp) => <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>)}
                    </select>
                  </label>
                  <label className="setup-label">
                    Reason / notes
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this transfer needed?" rows={3} className="setup-input" style={{ resize: "vertical" }} />
                  </label>
                  <div className="setup-actions">
                    <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Submitting…" : "Create transfer request"}</button>
                  </div>
                </form>
              )}

              {asset.status === "ALLOCATED" && canManage && activeAlloc && (
                <div style={{ padding: "0 18px 16px" }}>
                  <button type="button" className="qa-btn" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={() => setReturnOpen(true)}>
                    Mark returned
                  </button>
                </div>
              )}
            </div>
          )}

          {pendingTransfers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-head">
                <h2 style={{ color: "var(--hue-amber)" }}>Pending approvals</h2>
                <span className="count">{pendingTransfers.length} transfer{pendingTransfers.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="panel panel-warn" style={{ borderColor: "color-mix(in srgb, var(--hue-amber) 40%, var(--line))" }}>
                {pendingTransfers.map((t) => (
                  <div key={t.transfer_id} className="alloc-transfer-row">
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <span className="tag">{t.asset_tag}</span>
                      <div style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: 3 }}>
                        {t.from_employee_name ?? "—"} → {t.to_employee_name ?? "—"} · <span className="muted">{formatDate(t.requested_on)}</span>
                      </div>
                    </div>
                    {canApprove ? (
                      <div className="alloc-transfer-actions">
                        <button type="button" className="btn btn-accent" style={{ padding: "6px 14px", fontSize: "12px" }} onClick={() => handleApprove(t.transfer_id)}>Approve</button>
                        <button type="button" className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: "12px" }} onClick={() => handleReject(t.transfer_id)}>Reject</button>
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: "11px" }}>awaiting approval</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>Transfer log</h2>
            <span className="count">{transfers.length} total</span>
          </div>
          <div className="panel">
            <div className="alloc-tlog-head">
              <span>Asset</span>
              <span>From → To</span>
              <span>Status</span>
            </div>
            {transfersState.loading ? (
              <div className="alloc-tlog-row"><span className="muted">Loading…</span></div>
            ) : transfers.length === 0 ? (
              <div className="alloc-tlog-row"><span className="muted">No transfers yet.</span></div>
            ) : (
              transfers.map((t) => (
                <div key={t.transfer_id} className="alloc-tlog-row">
                  <span><span className="tag">{t.asset_tag}</span></span>
                  <span style={{ fontSize: "12px" }}>{t.from_employee_name ?? "—"} → {t.to_employee_name ?? "—"}</span>
                  <span className="chip" style={{ background: TRANSFER_STATUS_STYLE[t.status].bg, color: TRANSFER_STATUS_STYLE[t.status].fg, fontSize: "9.5px", padding: "2px 8px" }}>
                    {TRANSFER_STATUS_LABEL[t.status]}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="section-head">
              <h2>Recent allocations</h2>
              <span className="count">latest</span>
            </div>
            <div className="panel">
              {recentAllocState.loading ? (
                <div className="activity-item"><span className="muted">Loading…</span></div>
              ) : recentAllocs.length === 0 ? (
                <div className="activity-item"><span className="muted">No allocations yet.</span></div>
              ) : (
                recentAllocs.map((h) => (
                  <div key={h.allocation_id} className="activity-item">
                    <span className="adot" style={{ ["--a-color" as string]: h.status === "RETURNED" ? "var(--verify)" : "var(--hue-teal)" }} />
                    <span className="flex-1">
                      {h.asset_tag} {h.status === "RETURNED" ? "returned by" : "allocated to"} {h.employee_name ?? h.department_name ?? "—"}
                    </span>
                    <span className="atime">{formatDate(h.status === "RETURNED" ? h.actual_return_date : h.allocation_date)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {returnOpen && activeAlloc && (
        <div className="setup-overlay" onClick={() => setReturnOpen(false)}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>Return asset</h2>
              <button type="button" className="setup-close" onClick={() => setReturnOpen(false)} aria-label="Close">×</button>
            </div>
            <form className="setup-form" onSubmit={handleReturn}>
              <div style={{ fontSize: "13.5px" }}>
                <span className="tag">{asset?.asset_tag}</span>
                <span style={{ fontWeight: 600, marginLeft: 6 }}>{asset?.name}</span>
                <div style={{ marginTop: 4, fontSize: "12.5px", color: "var(--text-soft)" }}>
                  Currently held by <strong>{activeAlloc.employee_name ?? activeAlloc.department_name ?? "—"}</strong>
                </div>
              </div>
              <label className="setup-label">
                Condition on return <span className="req">*</span>
                <select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as AssetCondition)} className="setup-input">
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="setup-label">
                Check-in notes
                <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Any observations on return…" rows={3} className="setup-input" style={{ resize: "vertical" }} />
              </label>
              <div className="setup-actions">
                <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Processing…" : "Confirm return"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setReturnOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

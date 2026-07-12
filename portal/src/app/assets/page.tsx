"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-debounced";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import {
  assetsApi,
  ASSET_STATUS_HUE,
  ASSET_STATUS_LABEL,
  ASSET_STATUS_ORDER,
  type Asset,
  type AssetStatus,
} from "@/lib/api/assets";
import { categoriesApi } from "@/lib/api/categories";
import { departmentsApi } from "@/lib/api/departments";

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCost(cost: string | number | null): string {
  if (cost === null || cost === undefined || cost === "") return "—";
  const n = typeof cost === "string" ? Number(cost) : cost;
  if (Number.isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AssetsPage() {
  const { hasRole } = useAuth();
  const { success, error: toastError } = useToast();
  const canManage = hasRole("ADMIN", "ASSET_MANAGER");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);
  const [statusFilter, setStatusFilter] = useState<"All" | AssetStatus>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Asset | null>(null);

  const catState = useApi((s) => categoriesApi.list(s));
  const deptState = useApi((s) => departmentsApi.list(s));
  const categories = catState.data ?? [];
  const departments = deptState.data ?? [];

  const listState = useApi(
    (s) =>
      assetsApi.list(
        {
          q: search || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          category_id: categoryFilter === "All" ? undefined : categoryFilter,
          department_id: deptFilter === "All" ? undefined : deptFilter,
          page,
          page_size: PAGE_SIZE,
        },
        s,
      ),
    [search, statusFilter, categoryFilter, deptFilter, page],
  );

  const historyState = useApi(
    (s) => (selected ? assetsApi.history(selected.asset_id, s) : Promise.resolve([])),
    [selected?.asset_id],
  );

  const assets = listState.data?.items ?? [];
  const total = listState.data?.total ?? 0;
  const totalPages = listState.data?.total_pages ?? 0;

  const allocations = useMemo(
    () => (historyState.data ?? []).filter((e) => e.event_type === "ALLOCATION"),
    [historyState.data],
  );
  const maintenance = useMemo(
    () => (historyState.data ?? []).filter((e) => e.event_type === "MAINTENANCE"),
    [historyState.data],
  );

  function resetPageAnd(fn: () => void) {
    setPage(1);
    fn();
  }

  async function changeStatus(assetId: string, newStatus: AssetStatus) {
    try {
      const updated = await assetsApi.updateStatus(assetId, newStatus);
      success(`Status changed to ${ASSET_STATUS_LABEL[newStatus]}.`);
      setSelected(updated);
      listState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to change status.");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Assets</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Asset directory</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Search, track, and manage every registered asset across the organization.
          </p>
        </div>
        {canManage && (
          <Link href="/assets/register" className="qa-btn primary">
            + Register asset
          </Link>
        )}
      </div>

      <div className="asset-search-bar">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="asset-search-icon">
          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11L14.2 14.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => resetPageAnd(() => setSearchInput(e.target.value))}
          placeholder="Search by tag, serial, name, or QR code…"
          className="asset-search-input"
        />
        {searchInput && (
          <button type="button" className="asset-search-clear" onClick={() => setSearchInput("")} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="asset-filters">
        <div className="asset-filter-group">
          <span className="asset-filter-label">Status</span>
          <div className="asset-filter-pills">
            {(["All", ...ASSET_STATUS_ORDER] as const).map((s) => {
              const active = statusFilter === s;
              const hue = s === "All" ? null : ASSET_STATUS_HUE[s];
              return (
                <button
                  key={s}
                  type="button"
                  className={`asset-pill ${active ? "active" : ""}`}
                  style={active && hue ? { background: hue.bg, color: hue.fg, borderColor: hue.fg } : undefined}
                  onClick={() => resetPageAnd(() => setStatusFilter(s))}
                >
                  {s === "All" ? "All" : ASSET_STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="asset-dropdowns">
          <label className="asset-dropdown-label">
            Category
            <select value={categoryFilter} onChange={(e) => resetPageAnd(() => setCategoryFilter(e.target.value))} className="asset-dropdown">
              <option value="All">All</option>
              {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </label>
          <label className="asset-dropdown-label">
            Department
            <select value={deptFilter} onChange={(e) => resetPageAnd(() => setDeptFilter(e.target.value))} className="asset-dropdown">
              <option value="All">All</option>
              {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 4 }}>
        <h2>
          {total} asset{total !== 1 ? "s" : ""}
          {statusFilter !== "All" && <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {ASSET_STATUS_LABEL[statusFilter]}</span>}
        </h2>
        {totalPages > 1 && <span className="count">page {page} of {totalPages}</span>}
      </div>

      <div className="asset-layout">
        <div className="panel" style={{ minWidth: 0 }}>
          <div className="asset-row asset-row-head">
            <span>Tag</span>
            <span>Name</span>
            <span>Category</span>
            <span>Status</span>
            <span>Location</span>
          </div>

          {listState.loading ? (
            <div className="empty-state">Loading assets…</div>
          ) : listState.error ? (
            <div className="empty-state">
              <div className="es-icon">!</div>
              {listState.error}{" "}
              <button className="underline" onClick={listState.refetch}>Retry</button>
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <div className="es-icon">∅</div>
              No assets match your current filters.
            </div>
          ) : (
            assets.map((a) => (
              <button
                key={a.asset_id}
                type="button"
                className={`asset-row ${selected?.asset_id === a.asset_id ? "asset-row-selected" : ""}`}
                onClick={() => setSelected(selected?.asset_id === a.asset_id ? null : a)}
              >
                <span className="tag">{a.asset_tag}</span>
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span className="muted">{a.category_name ?? "—"}</span>
                <span className="chip" style={{ background: ASSET_STATUS_HUE[a.status].bg, color: ASSET_STATUS_HUE[a.status].fg }}>
                  {ASSET_STATUS_LABEL[a.status]}
                </span>
                <span className="muted" style={{ fontSize: "12px" }}>{a.location_name ?? "—"}</span>
              </button>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Prev
              </button>
              <span className="text-[12px] text-text-soft">page {page} of {totalPages}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next →
              </button>
            </div>
          )}
        </div>

        {selected && (
          <aside className="asset-detail">
            <div className="asset-detail-head">
              <div>
                <span className="tag" style={{ fontSize: "14px" }}>{selected.asset_tag}</span>
                <h3 style={{ marginTop: 4, fontSize: "17px" }}>{selected.name}</h3>
              </div>
              <button type="button" className="setup-close" onClick={() => setSelected(null)} aria-label="Close detail">×</button>
            </div>

            <div className="asset-detail-body">
              <div className="flex items-center gap-3">
                <span className="chip" style={{ background: ASSET_STATUS_HUE[selected.status].bg, color: ASSET_STATUS_HUE[selected.status].fg, fontSize: "11px" }}>
                  {ASSET_STATUS_LABEL[selected.status]}
                </span>
                {canManage && (
                  <label className="text-[11px] text-text-soft">
                    Change:{" "}
                    <select
                      className="asset-dropdown"
                      style={{ padding: "3px 8px", fontSize: "12px" }}
                      value={selected.status}
                      onChange={(e) => changeStatus(selected.asset_id, e.target.value as AssetStatus)}
                    >
                      {ASSET_STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{ASSET_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="asset-props">
                <div className="asset-prop"><span className="pk">Category</span><span className="pv">{selected.category_name ?? "—"}</span></div>
                <div className="asset-prop"><span className="pk">Serial</span><span className="pv" style={{ fontFamily: "ui-monospace, monospace" }}>{selected.serial_number ?? "—"}</span></div>
                <div className="asset-prop"><span className="pk">Department</span><span className="pv">{selected.department_name ?? "—"}</span></div>
                <div className="asset-prop"><span className="pk">Location</span><span className="pv">{selected.location_name ?? "—"}</span></div>
                <div className="asset-prop"><span className="pk">Condition</span><span className="pv">{selected.condition}</span></div>
                <div className="asset-prop"><span className="pk">Acquired</span><span className="pv">{formatDate(selected.acquisition_date)}</span></div>
                <div className="asset-prop"><span className="pk">Cost</span><span className="pv" style={{ fontFamily: "ui-monospace, monospace" }}>{formatCost(selected.acquisition_cost)}</span></div>
                <div className="asset-prop"><span className="pk">Bookable</span><span className="pv">{selected.is_bookable ? "Yes — shared resource" : "No"}</span></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="section-head">
                  <h2 style={{ fontSize: "13.5px" }}>Allocation history</h2>
                  <span className="count">{allocations.length} record{allocations.length !== 1 ? "s" : ""}</span>
                </div>
                {historyState.loading ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>Loading…</div>
                ) : allocations.length === 0 ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>No allocation history for this asset.</div>
                ) : (
                  <div className="panel">
                    {allocations.map((al, i) => (
                      <div key={i} className="activity-item" style={{ fontSize: "12.5px", padding: "10px 12px" }}>
                        <span className="adot" style={{ ["--a-color" as string]: "var(--hue-amber)", marginTop: 4 }} />
                        <span className="flex-1">
                          <strong>{al.action}</strong>
                          <span className="muted" style={{ marginLeft: 6, fontSize: "11px" }}>{formatDate(al.performed_on)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="section-head">
                  <h2 style={{ fontSize: "13.5px" }}>Maintenance history</h2>
                  <span className="count">{maintenance.length} record{maintenance.length !== 1 ? "s" : ""}</span>
                </div>
                {historyState.loading ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>Loading…</div>
                ) : maintenance.length === 0 ? (
                  <div className="empty-state" style={{ padding: "14px 8px", fontSize: "12.5px" }}>No maintenance records.</div>
                ) : (
                  <div className="panel">
                    {maintenance.map((m, i) => (
                      <div key={i} className="activity-item" style={{ fontSize: "12.5px", padding: "10px 12px" }}>
                        <span className="adot" style={{ ["--a-color" as string]: "var(--hue-violet)", marginTop: 4 }} />
                        <span className="flex-1">
                          <span>{m.action}</span>
                          <span className="muted" style={{ marginLeft: 6, fontSize: "11px" }}>{formatDate(m.performed_on)}</span>
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

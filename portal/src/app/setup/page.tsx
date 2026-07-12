"use client";

import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { ROLE_LABEL, type RoleCode } from "@/lib/auth-context";
import { departmentsApi } from "@/lib/api/departments";
import { categoriesApi } from "@/lib/api/categories";
import { employeesApi } from "@/lib/api/employees";

type Tab = "departments" | "categories" | "employees";

const ROLE_ORDER: RoleCode[] = ["EMPLOYEE", "DEPT_HEAD", "ASSET_MANAGER", "ADMIN"];

function StatusChip({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className="chip"
      style={{
        background: active
          ? "color-mix(in srgb, var(--verify) 14%, transparent)"
          : "color-mix(in srgb, var(--muted) 14%, transparent)",
        color: active ? "var(--verify)" : "var(--muted)",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleChip({ role }: { role: RoleCode }) {
  const hueMap: Record<RoleCode, { bg: string; fg: string }> = {
    ADMIN: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
    ASSET_MANAGER: { bg: "var(--hue-teal-soft)", fg: "var(--hue-teal)" },
    DEPT_HEAD: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
    EMPLOYEE: { bg: "color-mix(in srgb, var(--muted) 14%, transparent)", fg: "var(--muted)" },
  };
  const h = hueMap[role] ?? hueMap.EMPLOYEE;
  return (
    <span className="chip" style={{ background: h.bg, color: h.fg }}>
      {ROLE_LABEL[role]}
    </span>
  );
}

export default function SetupPage() {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("departments");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const deptState = useApi((s) => departmentsApi.list(s));
  const catState = useApi((s) => categoriesApi.list(s));
  const empState = useApi((s) => employeesApi.list(undefined, s));

  const departments = deptState.data ?? [];
  const categories = catState.data ?? [];
  const employees = empState.data ?? [];

  const deptById = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.department_id, d.name));
    return m;
  }, [departments]);
  const empById = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.employee_id, e.name));
    return m;
  }, [employees]);

  /* form state — departments */
  const [deptName, setDeptName] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptParent, setDeptParent] = useState("");

  /* form state — categories */
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  function resetForm() {
    setDeptName("");
    setDeptHead("");
    setDeptParent("");
    setCatName("");
    setCatDesc("");
    setFormError(null);
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
  }

  async function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await departmentsApi.create({
        name: deptName.trim(),
        head_employee_id: deptHead || null,
        parent_department_id: deptParent || null,
      });
      success("Department created.");
      closeModal();
      deptState.refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create department.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await categoriesApi.create({
        name: catName.trim(),
        description: catDesc.trim() || null,
      });
      success("Category created.");
      closeModal();
      catState.refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create category.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePromote(employeeId: string, newRole: RoleCode) {
    try {
      await employeesApi.promote(employeeId, newRole);
      success("Role updated.");
      empState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to update role.");
    }
  }

  async function handleDeactivate(employeeId: string) {
    if (!confirm("Deactivate this employee? They will lose access.")) return;
    try {
      await employeesApi.remove(employeeId);
      success("Employee deactivated.");
      empState.refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Failed to deactivate.");
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "departments", label: "Departments", count: departments.length },
    { key: "categories", label: "Categories", count: categories.length },
    { key: "employees", label: "Employees", count: employees.length },
  ];

  const loadingByTab: Record<Tab, boolean> = {
    departments: deptState.loading,
    categories: catState.loading,
    employees: empState.loading,
  };
  const errorByTab: Record<Tab, string | null> = {
    departments: deptState.error,
    categories: catState.error,
    employees: empState.error,
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Organization setup</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Manage departments, asset categories, and the employee directory — the master data everything else depends on.
          </p>
        </div>
      </div>

      <div className="setup-tabs-bar">
        <div className="setup-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`setup-tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              <span className="tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        {activeTab !== "employees" && (
          <button type="button" className="qa-btn primary" onClick={openModal}>
            {activeTab === "departments" ? "+ Add department" : "+ Add category"}
          </button>
        )}
      </div>

      {/* DEPARTMENTS */}
      {activeTab === "departments" && (
        <div className="panel">
          <div
            className="list-row"
            style={{
              gridTemplateColumns: "1.3fr 1fr 1fr 0.7fr",
              background: "var(--paper-raised)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
            }}
          >
            <span>Department</span>
            <span>Head</span>
            <span>Parent dept.</span>
            <span>Status</span>
          </div>
          {loadingByTab.departments ? (
            <div className="list-row"><span className="muted">Loading…</span></div>
          ) : errorByTab.departments ? (
            <div className="list-row"><span className="muted">{errorByTab.departments}</span></div>
          ) : departments.length === 0 ? (
            <div className="list-row"><span className="muted">No departments yet.</span></div>
          ) : (
            departments.map((d) => (
              <div key={d.department_id} className="list-row" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 0.7fr" }}>
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span>{d.head_employee_id ? empById.get(d.head_employee_id) ?? "—" : "—"}</span>
                <span className="muted">{d.parent_department_id ? deptById.get(d.parent_department_id) ?? "—" : "—"}</span>
                <StatusChip status={d.status} />
              </div>
            ))
          )}
          <div className="setup-table-footer">
            Adding a Department here also lets you scope audits and reports by department.
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      {activeTab === "categories" && (
        <div className="panel">
          <div
            className="list-row"
            style={{
              gridTemplateColumns: "1.2fr 2fr 0.6fr",
              background: "var(--paper-raised)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
            }}
          >
            <span>Category</span>
            <span>Description</span>
            <span>Status</span>
          </div>
          {loadingByTab.categories ? (
            <div className="list-row"><span className="muted">Loading…</span></div>
          ) : errorByTab.categories ? (
            <div className="list-row"><span className="muted">{errorByTab.categories}</span></div>
          ) : categories.length === 0 ? (
            <div className="list-row"><span className="muted">No categories yet.</span></div>
          ) : (
            categories.map((c) => (
              <div key={c.category_id} className="list-row" style={{ gridTemplateColumns: "1.2fr 2fr 0.6fr" }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span className="muted" style={{ fontSize: "12.5px" }}>{c.description || "—"}</span>
                <StatusChip status={c.status} />
              </div>
            ))
          )}
          <div className="setup-table-footer">
            Categories let you attach custom fields specific to an asset type (e.g. warranty period for Electronics).
          </div>
        </div>
      )}

      {/* EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="panel">
          <div
            className="list-row"
            style={{
              gridTemplateColumns: "1fr 1.2fr 0.8fr 0.9fr 0.9fr",
              background: "var(--paper-raised)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
            }}
          >
            <span>Name</span>
            <span>Email</span>
            <span>Department</span>
            <span>Role</span>
            <span>Actions</span>
          </div>
          {loadingByTab.employees ? (
            <div className="list-row"><span className="muted">Loading…</span></div>
          ) : errorByTab.employees ? (
            <div className="list-row"><span className="muted">{errorByTab.employees}</span></div>
          ) : employees.length === 0 ? (
            <div className="list-row"><span className="muted">No employees yet.</span></div>
          ) : (
            employees.map((emp) => {
              const role = emp.role_code as RoleCode;
              return (
                <div key={emp.employee_id} className="list-row" style={{ gridTemplateColumns: "1fr 1.2fr 0.8fr 0.9fr 0.9fr" }}>
                  <span style={{ fontWeight: 600 }}>{emp.name}</span>
                  <span className="muted" style={{ fontSize: "12.5px" }}>{emp.email}</span>
                  <span>{emp.department_id ? deptById.get(emp.department_id) ?? emp.department_name ?? "—" : "—"}</span>
                  <select
                    className="setup-input"
                    style={{ padding: "4px 8px", fontSize: "12.5px" }}
                    value={role}
                    onChange={(e) => handlePromote(emp.employee_id, e.target.value as RoleCode)}
                    disabled={emp.status !== "ACTIVE"}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <span className="flex items-center gap-2">
                    <StatusChip status={emp.status} />
                    {emp.status === "ACTIVE" && (
                      <button
                        type="button"
                        className="text-[12px] text-[color:var(--hue-coral)] underline"
                        onClick={() => handleDeactivate(emp.employee_id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </span>
                </div>
              );
            })
          )}
          <div className="setup-table-footer">
            This is the only place roles are assigned. Signup creates Employees; promote to Department Head or Asset Manager here.
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className="setup-overlay" onClick={closeModal}>
          <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="setup-modal-head">
              <h2>{activeTab === "departments" ? "Add department" : "Add category"}</h2>
              <button type="button" className="setup-close" onClick={closeModal} aria-label="Close">×</button>
            </div>

            {formError && (
              <div className="mx-6 mb-2 rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3 py-2 text-[12.5px] text-[color:var(--hue-coral)]">
                {formError}
              </div>
            )}

            {activeTab === "departments" && (
              <form className="setup-form" onSubmit={handleDeptSubmit}>
                <label className="setup-label">
                  Department name <span className="req">*</span>
                  <input type="text" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Marketing" className="setup-input" autoFocus required />
                </label>
                <label className="setup-label">
                  Department Head
                  <select value={deptHead} onChange={(e) => setDeptHead(e.target.value)} className="setup-input">
                    <option value="">— none —</option>
                    {employees.filter((e) => e.status === "ACTIVE").map((e) => (
                      <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
                    ))}
                  </select>
                </label>
                <label className="setup-label">
                  Parent department
                  <select value={deptParent} onChange={(e) => setDeptParent(e.target.value)} className="setup-input">
                    <option value="">— none (top-level) —</option>
                    {departments.filter((d) => d.status === "ACTIVE").map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <div className="setup-actions">
                  <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Adding…" : "Add department"}</button>
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </form>
            )}

            {activeTab === "categories" && (
              <form className="setup-form" onSubmit={handleCatSubmit}>
                <label className="setup-label">
                  Category name <span className="req">*</span>
                  <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Office Supplies" className="setup-input" autoFocus required />
                </label>
                <label className="setup-label">
                  Description
                  <input type="text" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Short description of this category" className="setup-input" />
                  <span className="setup-hint">Custom fields can be attached to a category after it is created.</span>
                </label>
                <div className="setup-actions">
                  <button type="submit" className="btn btn-accent" disabled={submitting}>{submitting ? "Adding…" : "Add category"}</button>
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

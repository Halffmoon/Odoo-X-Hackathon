"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Admin" };

/* ── mock data ──────────────────────────────────────────────── */

const DEPARTMENTS_INIT = [
  { id: 1, name: "Engineering", head: "Ravi Shankar", parent: "—", status: "Active" },
  { id: 2, name: "Sales", head: "Priya Nair", parent: "—", status: "Active" },
  { id: 3, name: "HR", head: "Anil Joseph", parent: "—", status: "Active" },
  { id: 4, name: "QA", head: "Meena Rao", parent: "Engineering", status: "Active" },
  { id: 5, name: "Logistics", head: "Tarun Bhat", parent: "—", status: "Inactive" },
];

const CATEGORIES_INIT = [
  { id: 1, name: "Electronics", count: 214, fields: "Warranty period, Serial no.", status: "Active" },
  { id: 2, name: "Furniture", count: 87, fields: "—", status: "Active" },
  { id: 3, name: "Vehicles", count: 12, fields: "Reg. number, Insurance expiry", status: "Active" },
  { id: 4, name: "Equipment", count: 38, fields: "Calibration date", status: "Active" },
  { id: 5, name: "Real Estate", count: 5, fields: "Lease expiry", status: "Active" },
];

const EMPLOYEES_INIT = [
  { id: 1, name: "Arjun Mehta", email: "arjun@assetflow.in", dept: "Engineering", role: "Admin", status: "Active" },
  { id: 2, name: "Priya Nair", email: "priya@assetflow.in", dept: "Sales", role: "Department Head", status: "Active" },
  { id: 3, name: "Ravi Shankar", email: "ravi@assetflow.in", dept: "Engineering", role: "Department Head", status: "Active" },
  { id: 4, name: "Sana Qureshi", email: "sana@assetflow.in", dept: "Engineering", role: "Employee", status: "Active" },
  { id: 5, name: "Rohan Iyer", email: "rohan@assetflow.in", dept: "HR", role: "Employee", status: "Active" },
  { id: 6, name: "Tarun Bhat", email: "tarun@assetflow.in", dept: "Logistics", role: "Asset Manager", status: "Active" },
  { id: 7, name: "Meena Rao", email: "meena@assetflow.in", dept: "QA", role: "Department Head", status: "Active" },
  { id: 8, name: "Kiran Desai", email: "kiran@assetflow.in", dept: "Sales", role: "Employee", status: "Inactive" },
];

const ROLE_OPTIONS = ["Employee", "Department Head", "Asset Manager"];

type Tab = "departments" | "categories" | "employees";

/* ── helpers ────────────────────────────────────────────────── */

function StatusChip({ status }: { status: string }) {
  const active = status === "Active";
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
      {status}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  const hueMap: Record<string, { bg: string; fg: string }> = {
    Admin: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
    "Asset Manager": { bg: "var(--hue-teal-soft)", fg: "var(--hue-teal)" },
    "Department Head": { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
    Employee: { bg: "color-mix(in srgb, var(--muted) 14%, transparent)", fg: "var(--muted)" },
  };
  const h = hueMap[role] ?? hueMap.Employee;
  return (
    <span className="chip" style={{ background: h.bg, color: h.fg }}>
      {role}
    </span>
  );
}

/* ── component ──────────────────────────────────────────────── */

export default function SetupPage() {
  const [activeTab, setActiveTab] = useState<Tab>("departments");
  const [modalOpen, setModalOpen] = useState(false);

  /* data state */
  const [departments, setDepartments] = useState(DEPARTMENTS_INIT);
  const [categories, setCategories] = useState(CATEGORIES_INIT);
  const [employees, setEmployees] = useState(EMPLOYEES_INIT);

  /* form state — departments */
  const [deptName, setDeptName] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [deptStatus, setDeptStatus] = useState("Active");

  /* form state — categories */
  const [catName, setCatName] = useState("");
  const [catFields, setCatFields] = useState("");
  const [catStatus, setCatStatus] = useState("Active");

  /* form state — employees */
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empDept, setEmpDept] = useState("");
  const [empRole, setEmpRole] = useState("Employee");
  const [empStatus, setEmpStatus] = useState("Active");

  /* reset form */
  function resetForm() {
    setDeptName(""); setDeptHead(""); setDeptParent(""); setDeptStatus("Active");
    setCatName(""); setCatFields(""); setCatStatus("Active");
    setEmpName(""); setEmpEmail(""); setEmpDept(""); setEmpRole("Employee"); setEmpStatus("Active");
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  /* submit handlers */
  function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deptName.trim()) return;
    setDepartments((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: deptName.trim(),
        head: deptHead.trim() || "—",
        parent: deptParent || "—",
        status: deptStatus,
      },
    ]);
    closeModal();
  }

  function handleCatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setCategories((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: catName.trim(),
        count: 0,
        fields: catFields.trim() || "—",
        status: catStatus,
      },
    ]);
    closeModal();
  }

  function handleEmpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empName.trim() || !empEmail.trim()) return;
    setEmployees((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: empName.trim(),
        email: empEmail.trim(),
        dept: empDept || departments[0]?.name || "—",
        role: empRole,
        status: empStatus,
      },
    ]);
    closeModal();
  }

  /* tab labels */
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "departments", label: "Departments", count: departments.length },
    { key: "categories", label: "Categories", count: categories.length },
    { key: "employees", label: "Employees", count: employees.length },
  ];

  /* label for Add button */
  const addLabel: Record<Tab, string> = {
    departments: "+ Add department",
    categories: "+ Add category",
    employees: "+ Add employee",
  };

  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-2 text-[26px] sm:text-[30px]">Organization setup</h1>
          <p className="mt-1.5 text-[14px] text-text-soft">
            Manage departments, asset categories, and the employee directory — the master data everything else depends on.
          </p>
        </div>
      </div>

      {/* tabs + add */}
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
        <button type="button" className="qa-btn primary" onClick={openModal}>
          {addLabel[activeTab]}
        </button>
      </div>

      {/* ── DEPARTMENTS TAB ──────────────────────────── */}
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
          {departments.map((d) => (
            <div
              key={d.id}
              className="list-row"
              style={{ gridTemplateColumns: "1.3fr 1fr 1fr 0.7fr" }}
            >
              <span style={{ fontWeight: 600 }}>{d.name}</span>
              <span>{d.head}</span>
              <span className="muted">{d.parent}</span>
              <StatusChip status={d.status} />
            </div>
          ))}
          <div className="setup-table-footer">
            Adding a Department here also lets you scope audits and reports by department.
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ───────────────────────────── */}
      {activeTab === "categories" && (
        <div className="panel">
          <div
            className="list-row"
            style={{
              gridTemplateColumns: "1.2fr 0.5fr 1.5fr 0.6fr",
              background: "var(--paper-raised)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
            }}
          >
            <span>Category</span>
            <span>Assets</span>
            <span>Custom fields</span>
            <span>Status</span>
          </div>
          {categories.map((c) => (
            <div
              key={c.id}
              className="list-row"
              style={{ gridTemplateColumns: "1.2fr 0.5fr 1.5fr 0.6fr" }}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span className="muted" style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{c.count}</span>
              <span className="muted" style={{ fontSize: "12.5px" }}>{c.fields}</span>
              <StatusChip status={c.status} />
            </div>
          ))}
          <div className="setup-table-footer">
            Categories let you attach custom fields specific to an asset type (e.g. warranty period for Electronics).
          </div>
        </div>
      )}

      {/* ── EMPLOYEES TAB ────────────────────────────── */}
      {activeTab === "employees" && (
        <div className="panel">
          <div
            className="list-row"
            style={{
              gridTemplateColumns: "1fr 1.2fr 0.8fr 0.8fr 0.6fr",
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
            <span>Status</span>
          </div>
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="list-row"
              style={{ gridTemplateColumns: "1fr 1.2fr 0.8fr 0.8fr 0.6fr" }}
            >
              <span style={{ fontWeight: 600 }}>{emp.name}</span>
              <span className="muted" style={{ fontSize: "12.5px" }}>{emp.email}</span>
              <span>{emp.dept}</span>
              <RoleChip role={emp.role} />
              <StatusChip status={emp.status} />
            </div>
          ))}
          <div className="setup-table-footer">
            This is the only place roles are assigned. Admin promotes an Employee to Department Head or Asset Manager here.
          </div>
        </div>
      )}

      {/* ── MODAL OVERLAY ────────────────────────────── */}
      {modalOpen && (
        <div className="setup-overlay" onClick={closeModal}>
          <div
            className="setup-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="setup-modal-head">
              <h2>
                {activeTab === "departments" && "Add department"}
                {activeTab === "categories" && "Add category"}
                {activeTab === "employees" && "Add employee"}
              </h2>
              <button type="button" className="setup-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>

            {/* DEPARTMENT FORM */}
            {activeTab === "departments" && (
              <form className="setup-form" onSubmit={handleDeptSubmit}>
                <label className="setup-label">
                  Department name <span className="req">*</span>
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Marketing"
                    className="setup-input"
                    autoFocus
                    required
                  />
                </label>
                <label className="setup-label">
                  Department Head
                  <select
                    value={deptHead}
                    onChange={(e) => setDeptHead(e.target.value)}
                    className="setup-input"
                  >
                    <option value="">— none —</option>
                    {employees
                      .filter((e) => e.status === "Active")
                      .map((e) => (
                        <option key={e.id} value={e.name}>{e.name}</option>
                      ))}
                  </select>
                </label>
                <label className="setup-label">
                  Parent department
                  <select
                    value={deptParent}
                    onChange={(e) => setDeptParent(e.target.value)}
                    className="setup-input"
                  >
                    <option value="">— none (top-level) —</option>
                    {departments
                      .filter((d) => d.status === "Active")
                      .map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                  </select>
                </label>
                <label className="setup-label">
                  Status
                  <select
                    value={deptStatus}
                    onChange={(e) => setDeptStatus(e.target.value)}
                    className="setup-input"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <div className="setup-actions">
                  <button type="submit" className="btn btn-accent">Add department</button>
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </form>
            )}

            {/* CATEGORY FORM */}
            {activeTab === "categories" && (
              <form className="setup-form" onSubmit={handleCatSubmit}>
                <label className="setup-label">
                  Category name <span className="req">*</span>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Office Supplies"
                    className="setup-input"
                    autoFocus
                    required
                  />
                </label>
                <label className="setup-label">
                  Custom fields
                  <input
                    type="text"
                    value={catFields}
                    onChange={(e) => setCatFields(e.target.value)}
                    placeholder="e.g. Warranty period, Serial no."
                    className="setup-input"
                  />
                  <span className="setup-hint">Comma-separated. These appear as extra fields during asset registration.</span>
                </label>
                <label className="setup-label">
                  Status
                  <select
                    value={catStatus}
                    onChange={(e) => setCatStatus(e.target.value)}
                    className="setup-input"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <div className="setup-actions">
                  <button type="submit" className="btn btn-accent">Add category</button>
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </form>
            )}

            {/* EMPLOYEE FORM */}
            {activeTab === "employees" && (
              <form className="setup-form" onSubmit={handleEmpSubmit}>
                <label className="setup-label">
                  Full name <span className="req">*</span>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="e.g. Neha Sharma"
                    className="setup-input"
                    autoFocus
                    required
                  />
                </label>
                <label className="setup-label">
                  Work email <span className="req">*</span>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="neha@company.com"
                    className="setup-input"
                    required
                  />
                </label>
                <label className="setup-label">
                  Department
                  <select
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                    className="setup-input"
                  >
                    {departments
                      .filter((d) => d.status === "Active")
                      .map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                  </select>
                </label>
                <label className="setup-label">
                  Role
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="setup-input"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <span className="setup-hint">Signup only creates Employees. Promote to Department Head or Asset Manager here.</span>
                </label>
                <label className="setup-label">
                  Status
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value)}
                    className="setup-input"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <div className="setup-actions">
                  <button type="submit" className="btn btn-accent">Add employee</button>
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

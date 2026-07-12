-- =====================================================================
-- ASSETFLOW — ENTERPRISE ASSET & RESOURCE MANAGEMENT SYSTEM
-- Complete PostgreSQL Schema with Mapped REST API Endpoints
-- =====================================================================
-- Conventions:
--   * UUID primary keys (gen_random_uuid() — requires pgcrypto extension)
--   * Every table: created_by/created_on, updated_by/updated_on (where mutable)
--   * Soft delete via is_deleted where applicable
--   * All state fields constrained via CHECK (fixed, well-known enum sets)
--   * API endpoints listed directly above each table as comments
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- required for booking overlap EXCLUDE constraint

-- =====================================================================
-- MASTER TABLES
-- =====================================================================

-- API:
--   GET    /api/departments
--   GET    /api/departments/{id}
--   POST   /api/departments                 (Admin)
--   PUT    /api/departments/{id}             (Admin)
--   DELETE /api/departments/{id}             (Admin, soft delete/deactivate)
--   GET    /api/departments/{id}/hierarchy   (children tree)
CREATE TABLE departments (
    department_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR(120)  NOT NULL,
    parent_department_id   UUID          NULL REFERENCES departments(department_id),
    head_employee_id       UUID          NULL,  -- FK added after employees table is created
    status                 VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (name, parent_department_id)
);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);

-- API:
--   GET    /api/categories
--   GET    /api/categories/{id}
--   POST   /api/categories                  (Admin)
--   PUT    /api/categories/{id}              (Admin)
--   DELETE /api/categories/{id}              (Admin, blocked if assets exist)
CREATE TABLE asset_categories (
    category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);

-- API:
--   GET    /api/categories/{id}/fields
--   POST   /api/categories/{id}/fields       (Admin)
--   PUT    /api/categories/{id}/fields/{fieldId}  (Admin)
--   DELETE /api/categories/{id}/fields/{fieldId}  (Admin)
CREATE TABLE category_custom_fields (
    field_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID NOT NULL REFERENCES asset_categories(category_id),
    field_name    VARCHAR(100) NOT NULL,
    field_type    VARCHAR(20)  NOT NULL CHECK (field_type IN ('TEXT','NUMBER','DATE','BOOLEAN')),
    is_required   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (category_id, field_name)
);

-- API:
--   GET    /api/locations
--   POST   /api/locations                    (Admin)
--   PUT    /api/locations/{id}                (Admin)
--   DELETE /api/locations/{id}                (Admin)
CREATE TABLE locations (
    location_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    address       TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);

-- API:
--   GET    /api/roles   (static lookup, read-only)
CREATE TABLE roles (
    role_id    SMALLSERIAL PRIMARY KEY,
    role_code  VARCHAR(30) NOT NULL UNIQUE   -- ADMIN, ASSET_MANAGER, DEPT_HEAD, EMPLOYEE
);

-- =====================================================================
-- IDENTITY & ACCESS
-- =====================================================================

-- API:
--   POST   /api/auth/signup
--   POST   /api/auth/login
--   POST   /api/auth/logout
--   POST   /api/auth/forgot-password
--   POST   /api/auth/reset-password
CREATE TABLE users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','LOCKED','INACTIVE')),
    last_login_on  TIMESTAMPTZ,
    created_on     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_on     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API:
--   POST   /api/auth/forgot-password   (creates a token row, emails the raw token)
--   POST   /api/auth/reset-password    (looks up by token_hash, checks expiry + used_on)
-- Only the SHA-256 hash of the token is stored — never the raw token — same principle as
-- password_hash on users. A token is single-use, enforced by setting used_on on redemption.
CREATE TABLE password_reset_tokens (
    token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id),
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    expires_on   TIMESTAMPTZ NOT NULL,
    used_on      TIMESTAMPTZ,
    created_on   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);

-- API:
--   GET    /api/employees
--   GET    /api/employees/{id}
--   PUT    /api/employees/{id}                (Admin/self limited fields)
--   DELETE /api/employees/{id}                 (Admin, deactivate only)
--   POST   /api/employees/{id}/promote         (Admin — assign DEPT_HEAD/ASSET_MANAGER)
CREATE TABLE employees (
    employee_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(user_id),
    name           VARCHAR(150) NOT NULL,
    department_id  UUID REFERENCES departments(department_id),
    role_id        SMALLINT NOT NULL REFERENCES roles(role_id),
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_role ON employees(role_id);

ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_employee_id) REFERENCES employees(employee_id);

-- API:
--   GET    /api/employees/{id}/role-history
CREATE TABLE role_assignment_history (
    role_history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(employee_id),
    old_role_id      SMALLINT REFERENCES roles(role_id),
    new_role_id      SMALLINT NOT NULL REFERENCES roles(role_id),
    changed_by       UUID NOT NULL REFERENCES employees(employee_id),
    changed_on       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- ASSET REGISTRY
-- =====================================================================

-- API:
--   GET    /api/assets
--   GET    /api/assets/search?q=&status=&category=&department=&location=
--   GET    /api/assets/{id}
--   POST   /api/assets                        (Asset Manager)
--   PUT    /api/assets/{id}                    (Asset Manager)
--   DELETE /api/assets/{id}                    (Asset Manager, soft delete)
--   PATCH  /api/assets/{id}/status             (system/Asset Manager — lifecycle transition)
--   GET    /api/assets/{id}/history            (allocation + maintenance history combined)
CREATE TABLE assets (
    asset_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag              VARCHAR(20)  NOT NULL UNIQUE,          -- auto-generated e.g. AF-0001
    name                    VARCHAR(150) NOT NULL,
    category_id             UUID NOT NULL REFERENCES asset_categories(category_id),
    serial_number           VARCHAR(100) UNIQUE,
    acquisition_date        DATE,
    acquisition_cost        NUMERIC(14,2),
    condition                VARCHAR(20)  NOT NULL DEFAULT 'GOOD'
                             CHECK (condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')),
    location_id              UUID REFERENCES locations(location_id),
    current_department_id    UUID REFERENCES departments(department_id),
    is_bookable               BOOLEAN NOT NULL DEFAULT false,
    status                    VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
                              CHECK (status IN ('AVAILABLE','ALLOCATED','RESERVED','UNDER_MAINTENANCE',
                                                 'LOST','RETIRED','DISPOSED')),
    qr_code                   VARCHAR(255),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_department ON assets(current_department_id);
CREATE INDEX idx_assets_location ON assets(location_id);

-- API:
--   GET    /api/assets/{id}/fields                 (values for this asset's category fields)
--   PUT    /api/assets/{id}/fields                  (Asset Manager — upsert values)
-- Stores the actual per-asset value for each category_custom_fields definition.
-- (category_custom_fields only defines the *schema* of extra fields; this table holds the *data*,
--  e.g. the actual warranty-period value for one specific Electronics asset.)
CREATE TABLE asset_custom_field_values (
    value_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id      UUID NOT NULL REFERENCES assets(asset_id),
    field_id      UUID NOT NULL REFERENCES category_custom_fields(field_id),
    text_value    TEXT,
    number_value  NUMERIC(18,4),
    date_value    DATE,
    boolean_value BOOLEAN,
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_id, field_id)
);
CREATE INDEX idx_acfv_asset ON asset_custom_field_values(asset_id);
CREATE INDEX idx_acfv_field ON asset_custom_field_values(field_id);

-- API:
--   GET    /api/assets/{id}/attachments
--   POST   /api/assets/{id}/attachments        (multipart upload)
--   GET    /api/maintenance/{id}/attachments
--   POST   /api/maintenance/{id}/attachments   (multipart upload — "attach photo" on a maintenance request)
--   DELETE /api/attachments/{id}
-- Polymorphic: exactly one of asset_id / maintenance_id is set per row.
-- maintenance_id FK is added further below via ALTER TABLE, once maintenance_requests exists
-- (same forward-reference pattern used for departments.head_employee_id).
CREATE TABLE asset_attachments (
    attachment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id       UUID REFERENCES assets(asset_id),
    maintenance_id UUID,
    file_url       TEXT NOT NULL,
    file_type      VARCHAR(20) NOT NULL CHECK (file_type IN ('PHOTO','DOCUMENT')),
    uploaded_by    UUID REFERENCES employees(employee_id),
    uploaded_on    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (asset_id IS NOT NULL AND maintenance_id IS NULL) OR
        (asset_id IS NULL AND maintenance_id IS NOT NULL)
    )
);
CREATE INDEX idx_attachments_asset ON asset_attachments(asset_id);
CREATE INDEX idx_attachments_maintenance ON asset_attachments(maintenance_id);

-- API:
--   GET    /api/assets/{id}/status-history      (read-only, system-generated)
CREATE TABLE asset_status_history (
    status_history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID NOT NULL REFERENCES assets(asset_id),
    old_status            VARCHAR(20),
    new_status             VARCHAR(20) NOT NULL,
    changed_by             UUID REFERENCES employees(employee_id),
    changed_on              TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                  TEXT
);
CREATE INDEX idx_ash_asset ON asset_status_history(asset_id);

-- =====================================================================
-- ALLOCATION & TRANSFER
-- =====================================================================

-- API:
--   GET    /api/allocations
--   GET    /api/allocations/{id}
--   POST   /api/allocations                     (Asset Manager/Dept Head — blocked if already ACTIVE)
--   POST   /api/allocations/{id}/return          (Asset Manager/Dept Head — condition + notes)
--   GET    /api/allocations/overdue              (dashboard feed)
CREATE TABLE asset_allocations (
    allocation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id                UUID NOT NULL REFERENCES assets(asset_id),
    employee_id              UUID REFERENCES employees(employee_id),
    department_id             UUID REFERENCES departments(department_id),
    allocation_date            DATE NOT NULL DEFAULT current_date,
    expected_return_date        DATE,
    actual_return_date           DATE,
    return_condition              VARCHAR(20) CHECK (return_condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')),
    return_notes                   TEXT,
    -- Only ACTIVE/RETURNED are stored. "Overdue" is not a distinct state — it is
    -- ACTIVE with expected_return_date < current_date, computed at query time
    -- (see v_overdue_allocations below) so it can never drift out of sync.
    status                          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (status IN ('ACTIVE','RETURNED')),
    allocated_by                    UUID REFERENCES employees(employee_id),
    created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expected_return_date IS NULL OR expected_return_date >= allocation_date),
    CHECK (actual_return_date IS NULL OR actual_return_date >= allocation_date),
    CHECK (employee_id IS NOT NULL OR department_id IS NOT NULL)   -- must allocate to someone
);
-- Enforces BR-02: one active allocation per asset at any time
CREATE UNIQUE INDEX uq_one_active_allocation
    ON asset_allocations(asset_id) WHERE (status = 'ACTIVE');
CREATE INDEX idx_alloc_employee ON asset_allocations(employee_id);
CREATE INDEX idx_alloc_department ON asset_allocations(department_id);
CREATE INDEX idx_alloc_status ON asset_allocations(status);

-- API:
--   GET    /api/transfers
--   GET    /api/transfers/{id}
--   POST   /api/transfers                        (Employee — initiate)
--   POST   /api/transfers/{id}/approve            (Asset Manager/Dept Head)
--   POST   /api/transfers/{id}/reject             (Asset Manager/Dept Head)
CREATE TABLE asset_transfers (
    transfer_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID NOT NULL REFERENCES assets(asset_id),
    from_employee_id      UUID REFERENCES employees(employee_id),
    to_employee_id         UUID NOT NULL REFERENCES employees(employee_id),
    requested_by            UUID NOT NULL REFERENCES employees(employee_id),
    approved_by              UUID REFERENCES employees(employee_id),
    status                    VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
                              CHECK (status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED')),
    requested_on              TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_on                TIMESTAMPTZ,
    completed_on                 TIMESTAMPTZ,
    remarks                       TEXT,
    CHECK (from_employee_id IS NULL OR from_employee_id <> to_employee_id)
);
CREATE INDEX idx_transfer_asset ON asset_transfers(asset_id);
CREATE INDEX idx_transfer_status ON asset_transfers(status);

-- API:
--   GET    /api/allocations/{id}/history          (read-only)
CREATE TABLE allocation_history (
    history_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id   UUID NOT NULL REFERENCES asset_allocations(allocation_id),
    action           VARCHAR(30) NOT NULL,  -- ALLOCATED, TRANSFERRED, RETURNED
    performed_by      UUID REFERENCES employees(employee_id),
    performed_on       TIMESTAMPTZ NOT NULL DEFAULT now(),
    details             JSONB
);
CREATE INDEX idx_alloc_hist_alloc ON allocation_history(allocation_id);

-- =====================================================================
-- RESOURCE BOOKING
-- =====================================================================

-- API:
--   GET    /api/bookings
--   GET    /api/bookings/{id}
--   GET    /api/bookings/availability?asset_id=&date=
--   POST   /api/bookings                          (Employee/Dept Head — overlap validated)
--   PUT    /api/bookings/{id}/reschedule           (owner)
--   POST   /api/bookings/{id}/cancel               (owner)
CREATE TABLE bookings (
    booking_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id         UUID NOT NULL REFERENCES assets(asset_id),
    employee_id        UUID NOT NULL REFERENCES employees(employee_id),
    -- Denormalized from employee_id at insert time (via trigger below) so department-level
    -- reports (e.g. booking heatmap by department) don't need a join through employees.
    department_id        UUID REFERENCES departments(department_id),
    start_time              TIMESTAMPTZ NOT NULL,
    end_time                  TIMESTAMPTZ NOT NULL,
    status                      VARCHAR(20) NOT NULL DEFAULT 'UPCOMING'
                                CHECK (status IN ('UPCOMING','ONGOING','COMPLETED','CANCELLED')),
    purpose                      VARCHAR(255),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX idx_bookings_asset_time ON bookings(asset_id, start_time, end_time);
CREATE INDEX idx_bookings_employee ON bookings(employee_id);
CREATE INDEX idx_bookings_department ON bookings(department_id);

-- Enforces BR-03: no overlapping active bookings for the same asset
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status IN ('UPCOMING','ONGOING'));

-- API:
--   GET    /api/bookings/{id}/history
CREATE TABLE booking_history (
    history_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id     UUID NOT NULL REFERENCES bookings(booking_id),
    action           VARCHAR(30) NOT NULL,  -- CREATED, CANCELLED, RESCHEDULED, COMPLETED
    performed_by      UUID REFERENCES employees(employee_id),
    performed_on        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_hist_booking ON booking_history(booking_id);

-- =====================================================================
-- MAINTENANCE
-- =====================================================================

-- API:
--   GET    /api/maintenance
--   GET    /api/maintenance/{id}
--   POST   /api/maintenance                       (Employee — raise request)
--   POST   /api/maintenance/{id}/approve           (Asset Manager)
--   POST   /api/maintenance/{id}/reject            (Asset Manager)
--   POST   /api/maintenance/{id}/assign-technician (Asset Manager)
--   POST   /api/maintenance/{id}/start             (Technician)
--   POST   /api/maintenance/{id}/resolve           (Technician)
-- NOTE: "Technician" is not a distinct role in the roles table (Admin/Asset Manager/Dept Head/
-- Employee only, per the product's User Roles). technician_id is deliberately just an
-- employees FK, not role-checked at the DB level — an Asset Manager assigns any employee
-- (in practice usually themself or a designated internal handler) to work the ticket.
-- If a formal Technician role is introduced later, add it to `roles` and enforce via app/API,
-- not a DB constraint (keeps the schema role-set open without a migration).
CREATE TABLE maintenance_requests (
    maintenance_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID NOT NULL REFERENCES assets(asset_id),
    requested_by           UUID NOT NULL REFERENCES employees(employee_id),
    issue_description        TEXT NOT NULL,
    priority                  VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                              CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    status                    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','APPROVED','REJECTED','TECHNICIAN_ASSIGNED',
                                                 'IN_PROGRESS','RESOLVED')),
    approved_by                UUID REFERENCES employees(employee_id),
    approved_on                  TIMESTAMPTZ,
    technician_id                  UUID REFERENCES employees(employee_id),
    resolved_on                      TIMESTAMPTZ,
    resolution_notes                   TEXT,
    created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_on  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_asset ON maintenance_requests(asset_id);
CREATE INDEX idx_maint_status ON maintenance_requests(status);
CREATE INDEX idx_maint_technician ON maintenance_requests(technician_id);

-- Deferred FK for asset_attachments.maintenance_id — maintenance_requests didn't exist yet
-- when asset_attachments was created above.
ALTER TABLE asset_attachments
    ADD CONSTRAINT fk_attachment_maintenance
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(maintenance_id);

-- API:
--   GET    /api/maintenance/{id}/history
CREATE TABLE maintenance_history (
    history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id    UUID NOT NULL REFERENCES maintenance_requests(maintenance_id),
    action              VARCHAR(30) NOT NULL,
    performed_by          UUID REFERENCES employees(employee_id),
    performed_on            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_hist_req ON maintenance_history(maintenance_id);

-- =====================================================================
-- AUDIT
-- =====================================================================

-- API:
--   GET    /api/audits
--   GET    /api/audits/{id}
--   POST   /api/audits                            (Admin/Asset Manager — create cycle + assign auditors)
--   POST   /api/audits/{id}/close                  (Admin/Asset Manager — blocked if incomplete)
CREATE TABLE audit_cycles (
    audit_cycle_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(150) NOT NULL,
    department_id       UUID REFERENCES departments(department_id),
    location_id           UUID REFERENCES locations(location_id),
    start_date              DATE NOT NULL,
    end_date                  DATE NOT NULL,
    status                     VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
                               CHECK (status IN ('PLANNED','IN_PROGRESS','CLOSED')),
    closed_by                   UUID REFERENCES employees(employee_id),
    closed_on                     TIMESTAMPTZ,
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_audit_cycles_status ON audit_cycles(status);

-- API:
--   GET    /api/audits/{id}/auditors
--   POST   /api/audits/{id}/auditors              (Admin/Asset Manager — assign)
--   DELETE /api/audits/{id}/auditors/{employeeId}  (Admin/Asset Manager — unassign)
CREATE TABLE audit_assignments (
    audit_assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id          UUID NOT NULL REFERENCES audit_cycles(audit_cycle_id),
    auditor_employee_id       UUID NOT NULL REFERENCES employees(employee_id),
    assigned_on                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (audit_cycle_id, auditor_employee_id)
);
CREATE INDEX idx_audit_assign_cycle ON audit_assignments(audit_cycle_id);

-- API:
--   GET    /api/audits/{id}/results
--   POST   /api/audits/{id}/results               (Auditor — record finding per asset)
CREATE TABLE audit_results (
    audit_result_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id      UUID NOT NULL REFERENCES audit_cycles(audit_cycle_id),
    asset_id               UUID NOT NULL REFERENCES assets(asset_id),
    auditor_employee_id      UUID NOT NULL REFERENCES employees(employee_id),
    finding                    VARCHAR(20) NOT NULL CHECK (finding IN ('VERIFIED','MISSING','DAMAGED')),
    remarks                      TEXT,
    recorded_on                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (audit_cycle_id, asset_id)
);
CREATE INDEX idx_audit_results_cycle ON audit_results(audit_cycle_id);
CREATE INDEX idx_audit_results_asset ON audit_results(asset_id);

-- API:
--   GET    /api/discrepancies
--   GET    /api/discrepancies/{id}
--   POST   /api/discrepancies/{id}/resolve         (Asset Manager)
CREATE TABLE audit_discrepancies (
    discrepancy_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_result_id     UUID NOT NULL UNIQUE REFERENCES audit_results(audit_result_id),
    status                 VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
    resolved_by              UUID REFERENCES employees(employee_id),
    resolved_on                TIMESTAMPTZ,
    resolution_notes             TEXT
);
CREATE INDEX idx_discrepancy_status ON audit_discrepancies(status);

-- =====================================================================
-- NOTIFICATIONS & ACTIVITY LOG
-- =====================================================================

-- API:
--   GET    /api/notifications                     (scoped to caller)
--   POST   /api/notifications/{id}/read
--   POST   /api/notifications/read-all
CREATE TABLE notifications (
    notification_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_employee_id    UUID NOT NULL REFERENCES employees(employee_id),
    type                        VARCHAR(50) NOT NULL,
    title                          VARCHAR(150) NOT NULL,
    message                          TEXT NOT NULL,
    reference_table                    VARCHAR(50),
    reference_id                          UUID,
    is_read                                  BOOLEAN NOT NULL DEFAULT false,
    created_on                                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON notifications(recipient_employee_id, is_read);

-- API:
--   GET    /api/logs                               (Admin/Manager — filter by entity/actor/date)
--   GET    /api/logs/{entityTable}/{entityId}       (entity-specific trail)
CREATE TABLE activity_logs (
    log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID REFERENCES users(user_id),
    action            VARCHAR(100) NOT NULL,
    entity_table        VARCHAR(50),
    entity_id             UUID,
    old_value               JSONB,
    new_value                 JSONB,
    ip_address                  VARCHAR(45),
    created_on                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_entity ON activity_logs(entity_table, entity_id);
CREATE INDEX idx_logs_actor ON activity_logs(actor_user_id);

-- =====================================================================
-- AUTOMATION: STATUS-SYNC TRIGGERS, DISCREPANCY AUTO-GENERATION, VIEWS
-- =====================================================================
-- These close the gap between "the API can write these rows" and "the product's stated
-- business rules actually hold" (e.g. "asset status auto-updates to Under Maintenance on
-- approval and back to Available on resolution"). Enforcing them here means they hold even
-- if a row is written outside the app's own service layer (a script, a console, a bug).

-- ---------------------------------------------------------------------
-- 1. Allocation -> asset status sync
--    ACTIVE allocation  => asset becomes ALLOCATED
--    RETURNED allocation => asset becomes AVAILABLE (unless currently UNDER_MAINTENANCE)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_asset_status_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
    v_old_status VARCHAR(20);
    v_new_status VARCHAR(20);
BEGIN
    SELECT status INTO v_old_status FROM assets WHERE asset_id = NEW.asset_id;

    IF NEW.status = 'ACTIVE' AND v_old_status <> 'UNDER_MAINTENANCE' THEN
        v_new_status := 'ALLOCATED';
    ELSIF NEW.status = 'RETURNED' AND v_old_status = 'ALLOCATED' THEN
        v_new_status := 'AVAILABLE';
    ELSE
        RETURN NEW;  -- no eligible transition (e.g. asset is under maintenance)
    END IF;

    UPDATE assets SET status = v_new_status, updated_on = now() WHERE asset_id = NEW.asset_id;

    INSERT INTO asset_status_history (asset_id, old_status, new_status, changed_by, reason)
    VALUES (NEW.asset_id, v_old_status, v_new_status, NEW.allocated_by,
            'auto: allocation ' || NEW.status);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_allocation_status_sync
    AFTER INSERT OR UPDATE OF status ON asset_allocations
    FOR EACH ROW EXECUTE FUNCTION fn_sync_asset_status_on_allocation();

-- ---------------------------------------------------------------------
-- 2. Maintenance -> asset status sync
--    status moves to APPROVED/TECHNICIAN_ASSIGNED/IN_PROGRESS => asset UNDER_MAINTENANCE
--    status moves to RESOLVED or REJECTED                    => asset AVAILABLE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_asset_status_on_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    v_old_status VARCHAR(20);
    v_new_status VARCHAR(20);
BEGIN
    SELECT status INTO v_old_status FROM assets WHERE asset_id = NEW.asset_id;

    IF NEW.status IN ('APPROVED','TECHNICIAN_ASSIGNED','IN_PROGRESS') THEN
        v_new_status := 'UNDER_MAINTENANCE';
    ELSIF NEW.status IN ('RESOLVED','REJECTED') AND v_old_status = 'UNDER_MAINTENANCE' THEN
        v_new_status := 'AVAILABLE';
    ELSE
        RETURN NEW;
    END IF;

    IF v_new_status = v_old_status THEN
        RETURN NEW;  -- e.g. already UNDER_MAINTENANCE; nothing to log
    END IF;

    UPDATE assets SET status = v_new_status, updated_on = now() WHERE asset_id = NEW.asset_id;

    INSERT INTO asset_status_history (asset_id, old_status, new_status, changed_by, reason)
    VALUES (NEW.asset_id, v_old_status, v_new_status, NEW.approved_by,
            'auto: maintenance ' || NEW.status);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_status_sync
    AFTER UPDATE OF status ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION fn_sync_asset_status_on_maintenance();

-- ---------------------------------------------------------------------
-- 3. Audit result -> discrepancy auto-generation
--    Any non-VERIFIED finding automatically opens a discrepancy record.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_autogen_audit_discrepancy()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.finding IN ('MISSING','DAMAGED') THEN
        INSERT INTO audit_discrepancies (audit_result_id, status)
        VALUES (NEW.audit_result_id, 'OPEN')
        ON CONFLICT (audit_result_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_discrepancy_autogen
    AFTER INSERT ON audit_results
    FOR EACH ROW EXECUTE FUNCTION fn_autogen_audit_discrepancy();

-- ---------------------------------------------------------------------
-- 4. Closing an audit cycle -> confirmed-missing assets become LOST
--    Fires when audit_cycles.status transitions into 'CLOSED'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_close_audit_cycle()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CLOSED' AND OLD.status <> 'CLOSED' THEN
        UPDATE assets SET status = 'LOST', updated_on = now()
        WHERE asset_id IN (
            SELECT ar.asset_id FROM audit_results ar
            WHERE ar.audit_cycle_id = NEW.audit_cycle_id AND ar.finding = 'MISSING'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_cycle_close
    AFTER UPDATE OF status ON audit_cycles
    FOR EACH ROW EXECUTE FUNCTION fn_close_audit_cycle();

-- ---------------------------------------------------------------------
-- 5. Booking department backfill — copies the booking employee's current
--    department onto the booking row for cheap department-level reporting.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_backfill_booking_department()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.department_id IS NULL THEN
        SELECT department_id INTO NEW.department_id
        FROM employees WHERE employee_id = NEW.employee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_department_backfill
    BEFORE INSERT ON bookings
    FOR EACH ROW EXECUTE FUNCTION fn_backfill_booking_department();

-- ---------------------------------------------------------------------
-- 6. Overdue allocations — computed, not stored (see note on asset_allocations.status
--    above). This view backs GET /api/allocations/overdue and the dashboard KPI.
-- ---------------------------------------------------------------------
CREATE VIEW v_overdue_allocations AS
SELECT
    al.allocation_id, al.asset_id, a.asset_tag, a.name AS asset_name,
    al.employee_id, al.department_id,
    al.expected_return_date,
    (current_date - al.expected_return_date) AS days_overdue
FROM asset_allocations al
JOIN assets a ON a.asset_id = al.asset_id
WHERE al.status = 'ACTIVE'
  AND al.expected_return_date IS NOT NULL
  AND al.expected_return_date < current_date;

-- =====================================================================
-- AGGREGATE / DASHBOARD ENDPOINTS (no dedicated table — computed views)
-- =====================================================================
-- API:
--   GET    /api/dashboard/kpis                     (role-scoped: available/allocated/maintenance/bookings/overdue)
--   GET    /api/reports/utilization
--   GET    /api/reports/maintenance-frequency
--   GET    /api/reports/department-summary
--   GET    /api/reports/booking-heatmap
--   GET    /api/reports/retirement-forecast
--   GET    /api/reports/export?type=&format=pdf|xlsx

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================

"""phase_1_initial_schema

Creates the full AssetFlow schema (the SQL contract) plus the three Phase-1
additions: refresh_tokens table, employees.employee_code, employees.phone.
Includes all triggers, functions, the overdue view, the booking EXCLUDE
constraint, the partial unique allocation index, and seeds the roles table.

Revision ID: 0001_phase1
Revises:
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001_phase1"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA_SQL = r"""
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------- MASTER TABLES ----------------
CREATE TABLE departments (
    department_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(120)  NOT NULL,
    parent_department_id  UUID          NULL REFERENCES departments(department_id),
    head_employee_id      UUID          NULL,
    status                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (name, parent_department_id)
);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);

CREATE TABLE asset_categories (
    category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE category_custom_fields (
    field_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID NOT NULL REFERENCES asset_categories(category_id),
    field_name    VARCHAR(100) NOT NULL,
    field_type    VARCHAR(20)  NOT NULL CHECK (field_type IN ('TEXT','NUMBER','DATE','BOOLEAN')),
    is_required   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (category_id, field_name)
);

CREATE TABLE locations (
    location_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    address       TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE roles (
    role_id    SMALLSERIAL PRIMARY KEY,
    role_code  VARCHAR(30) NOT NULL UNIQUE
);

-- ---------------- IDENTITY & ACCESS ----------------
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

CREATE TABLE password_reset_tokens (
    token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id),
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    expires_on   TIMESTAMPTZ NOT NULL,
    used_on      TIMESTAMPTZ,
    created_on   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);

-- ADDITION 1: refresh_tokens
CREATE TABLE refresh_tokens (
    token_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(user_id),
    token_hash     VARCHAR(255) NOT NULL UNIQUE,
    device_info    VARCHAR(255),
    expires_on     TIMESTAMPTZ NOT NULL,
    revoked_on     TIMESTAMPTZ,
    created_on     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ADDITION 2: employees.employee_code + phone
CREATE TABLE employees (
    employee_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(user_id),
    employee_code  VARCHAR(20) NOT NULL UNIQUE,
    phone          VARCHAR(20),
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

CREATE TABLE role_assignment_history (
    role_history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(employee_id),
    old_role_id      SMALLINT REFERENCES roles(role_id),
    new_role_id      SMALLINT NOT NULL REFERENCES roles(role_id),
    changed_by       UUID NOT NULL REFERENCES employees(employee_id),
    changed_on       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- ASSET REGISTRY ----------------
CREATE TABLE assets (
    asset_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag              VARCHAR(20)  NOT NULL UNIQUE,
    name                   VARCHAR(150) NOT NULL,
    category_id            UUID NOT NULL REFERENCES asset_categories(category_id),
    serial_number          VARCHAR(100) UNIQUE,
    acquisition_date       DATE,
    acquisition_cost       NUMERIC(14,2),
    condition              VARCHAR(20)  NOT NULL DEFAULT 'GOOD'
                           CHECK (condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')),
    location_id            UUID REFERENCES locations(location_id),
    current_department_id  UUID REFERENCES departments(department_id),
    is_bookable            BOOLEAN NOT NULL DEFAULT false,
    status                 VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
                           CHECK (status IN ('AVAILABLE','ALLOCATED','RESERVED','UNDER_MAINTENANCE',
                                             'LOST','RETIRED','DISPOSED')),
    qr_code                VARCHAR(255),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_department ON assets(current_department_id);
CREATE INDEX idx_assets_location ON assets(location_id);

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

CREATE TABLE asset_status_history (
    status_history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID NOT NULL REFERENCES assets(asset_id),
    old_status         VARCHAR(20),
    new_status         VARCHAR(20) NOT NULL,
    changed_by         UUID REFERENCES employees(employee_id),
    changed_on         TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason             TEXT
);
CREATE INDEX idx_ash_asset ON asset_status_history(asset_id);

-- ---------------- ALLOCATION & TRANSFER ----------------
CREATE TABLE asset_allocations (
    allocation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id               UUID NOT NULL REFERENCES assets(asset_id),
    employee_id            UUID REFERENCES employees(employee_id),
    department_id          UUID REFERENCES departments(department_id),
    allocation_date        DATE NOT NULL DEFAULT current_date,
    expected_return_date   DATE,
    actual_return_date     DATE,
    return_condition       VARCHAR(20) CHECK (return_condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')),
    return_notes           TEXT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE','RETURNED')),
    allocated_by           UUID REFERENCES employees(employee_id),
    created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expected_return_date IS NULL OR expected_return_date >= allocation_date),
    CHECK (actual_return_date IS NULL OR actual_return_date >= allocation_date),
    CHECK (employee_id IS NOT NULL OR department_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_one_active_allocation
    ON asset_allocations(asset_id) WHERE (status = 'ACTIVE');
CREATE INDEX idx_alloc_employee ON asset_allocations(employee_id);
CREATE INDEX idx_alloc_department ON asset_allocations(department_id);
CREATE INDEX idx_alloc_status ON asset_allocations(status);

CREATE TABLE asset_transfers (
    transfer_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID NOT NULL REFERENCES assets(asset_id),
    from_employee_id   UUID REFERENCES employees(employee_id),
    to_employee_id     UUID NOT NULL REFERENCES employees(employee_id),
    requested_by       UUID NOT NULL REFERENCES employees(employee_id),
    approved_by        UUID REFERENCES employees(employee_id),
    status             VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
                       CHECK (status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED')),
    requested_on       TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_on        TIMESTAMPTZ,
    completed_on       TIMESTAMPTZ,
    remarks            TEXT,
    CHECK (from_employee_id IS NULL OR from_employee_id <> to_employee_id)
);
CREATE INDEX idx_transfer_asset ON asset_transfers(asset_id);
CREATE INDEX idx_transfer_status ON asset_transfers(status);

CREATE TABLE allocation_history (
    history_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id  UUID NOT NULL REFERENCES asset_allocations(allocation_id),
    action         VARCHAR(30) NOT NULL,
    performed_by   UUID REFERENCES employees(employee_id),
    performed_on   TIMESTAMPTZ NOT NULL DEFAULT now(),
    details        JSONB
);
CREATE INDEX idx_alloc_hist_alloc ON allocation_history(allocation_id);

-- ---------------- RESOURCE BOOKING ----------------
CREATE TABLE bookings (
    booking_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id       UUID NOT NULL REFERENCES assets(asset_id),
    employee_id    UUID NOT NULL REFERENCES employees(employee_id),
    department_id  UUID REFERENCES departments(department_id),
    start_time     TIMESTAMPTZ NOT NULL,
    end_time       TIMESTAMPTZ NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'UPCOMING'
                   CHECK (status IN ('UPCOMING','ONGOING','COMPLETED','CANCELLED')),
    purpose        VARCHAR(255),
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID, updated_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX idx_bookings_asset_time ON bookings(asset_id, start_time, end_time);
CREATE INDEX idx_bookings_employee ON bookings(employee_id);
CREATE INDEX idx_bookings_department ON bookings(department_id);

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status IN ('UPCOMING','ONGOING'));

CREATE TABLE booking_history (
    history_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(booking_id),
    action       VARCHAR(30) NOT NULL,
    performed_by UUID REFERENCES employees(employee_id),
    performed_on TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_hist_booking ON booking_history(booking_id);

-- ---------------- MAINTENANCE ----------------
CREATE TABLE maintenance_requests (
    maintenance_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID NOT NULL REFERENCES assets(asset_id),
    requested_by       UUID NOT NULL REFERENCES employees(employee_id),
    issue_description  TEXT NOT NULL,
    priority           VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                       CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','APPROVED','REJECTED','TECHNICIAN_ASSIGNED',
                                         'IN_PROGRESS','RESOLVED')),
    approved_by        UUID REFERENCES employees(employee_id),
    approved_on        TIMESTAMPTZ,
    technician_id      UUID REFERENCES employees(employee_id),
    resolved_on        TIMESTAMPTZ,
    resolution_notes   TEXT,
    created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_on  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_asset ON maintenance_requests(asset_id);
CREATE INDEX idx_maint_status ON maintenance_requests(status);
CREATE INDEX idx_maint_technician ON maintenance_requests(technician_id);

ALTER TABLE asset_attachments
    ADD CONSTRAINT fk_attachment_maintenance
    FOREIGN KEY (maintenance_id) REFERENCES maintenance_requests(maintenance_id);

CREATE TABLE maintenance_history (
    history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id  UUID NOT NULL REFERENCES maintenance_requests(maintenance_id),
    action          VARCHAR(30) NOT NULL,
    performed_by    UUID REFERENCES employees(employee_id),
    performed_on    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_hist_req ON maintenance_history(maintenance_id);

-- ---------------- AUDIT ----------------
CREATE TABLE audit_cycles (
    audit_cycle_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    department_id   UUID REFERENCES departments(department_id),
    location_id     UUID REFERENCES locations(location_id),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
                    CHECK (status IN ('PLANNED','IN_PROGRESS','CLOSED')),
    closed_by       UUID REFERENCES employees(employee_id),
    closed_on       TIMESTAMPTZ,
    created_by  UUID, created_on  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_audit_cycles_status ON audit_cycles(status);

CREATE TABLE audit_assignments (
    audit_assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id       UUID NOT NULL REFERENCES audit_cycles(audit_cycle_id),
    auditor_employee_id  UUID NOT NULL REFERENCES employees(employee_id),
    assigned_on          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (audit_cycle_id, auditor_employee_id)
);
CREATE INDEX idx_audit_assign_cycle ON audit_assignments(audit_cycle_id);

CREATE TABLE audit_results (
    audit_result_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id   UUID NOT NULL REFERENCES audit_cycles(audit_cycle_id),
    asset_id         UUID NOT NULL REFERENCES assets(asset_id),
    auditor_employee_id  UUID NOT NULL REFERENCES employees(employee_id),
    finding          VARCHAR(20) NOT NULL CHECK (finding IN ('VERIFIED','MISSING','DAMAGED')),
    remarks          TEXT,
    recorded_on      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (audit_cycle_id, asset_id)
);
CREATE INDEX idx_audit_results_cycle ON audit_results(audit_cycle_id);
CREATE INDEX idx_audit_results_asset ON audit_results(asset_id);

CREATE TABLE audit_discrepancies (
    discrepancy_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_result_id  UUID NOT NULL UNIQUE REFERENCES audit_results(audit_result_id),
    status           VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
    resolved_by      UUID REFERENCES employees(employee_id),
    resolved_on      TIMESTAMPTZ,
    resolution_notes TEXT
);
CREATE INDEX idx_discrepancy_status ON audit_discrepancies(status);

-- ---------------- NOTIFICATIONS & ACTIVITY LOG ----------------
CREATE TABLE notifications (
    notification_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_employee_id  UUID NOT NULL REFERENCES employees(employee_id),
    type                   VARCHAR(50) NOT NULL,
    title                  VARCHAR(150) NOT NULL,
    message                TEXT NOT NULL,
    reference_table        VARCHAR(50),
    reference_id           UUID,
    is_read                BOOLEAN NOT NULL DEFAULT false,
    created_on             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON notifications(recipient_employee_id, is_read);

CREATE TABLE activity_logs (
    log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(user_id),
    action        VARCHAR(100) NOT NULL,
    entity_table  VARCHAR(50),
    entity_id     UUID,
    old_value     JSONB,
    new_value     JSONB,
    ip_address    VARCHAR(45),
    created_on    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_entity ON activity_logs(entity_table, entity_id);
CREATE INDEX idx_logs_actor ON activity_logs(actor_user_id);
"""


TRIGGERS_SQL = r"""
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
        RETURN NEW;
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
        RETURN NEW;
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
"""


SEED_SQL = r"""
INSERT INTO roles (role_id, role_code) VALUES
    (1, 'ADMIN'), (2, 'ASSET_MANAGER'), (3, 'DEPT_HEAD'), (4, 'EMPLOYEE')
ON CONFLICT (role_code) DO NOTHING;
-- Keep the SMALLSERIAL sequence ahead of the manually-seeded ids.
SELECT setval(pg_get_serial_sequence('roles', 'role_id'),
              (SELECT MAX(role_id) FROM roles));
"""


def _split_statements(script: str) -> list[str]:
    """Split a SQL script into top-level statements.

    asyncpg cannot run multiple commands in one execute(), so each statement
    is executed separately. Respects single-quoted strings, ``--`` line
    comments, and PostgreSQL dollar-quoted bodies (``$$`` / ``$tag$``) so that
    semicolons inside plpgsql functions do not split a statement.
    """
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(script)
    in_single = False
    dollar_tag: str | None = None

    while i < n:
        ch = script[i]

        if dollar_tag is not None:
            if script.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch)
            i += 1
            continue

        if in_single:
            buf.append(ch)
            if ch == "'":
                in_single = False
            i += 1
            continue

        # Line comment
        if ch == "-" and i + 1 < n and script[i + 1] == "-":
            while i < n and script[i] != "\n":
                buf.append(script[i])
                i += 1
            continue

        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue

        if ch == "$":
            j = i + 1
            while j < n and (script[j].isalnum() or script[j] == "_"):
                j += 1
            if j < n and script[j] == "$":
                dollar_tag = script[i : j + 1]
                buf.append(dollar_tag)
                i = j + 1
                continue

        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _run_script(script: str) -> None:
    for stmt in _split_statements(script):
        op.execute(stmt)


def upgrade() -> None:
    _run_script(SCHEMA_SQL)
    _run_script(TRIGGERS_SQL)
    _run_script(SEED_SQL)


def downgrade() -> None:
    _run_script(
        r"""
        DROP VIEW IF EXISTS v_overdue_allocations;
        DROP TABLE IF EXISTS activity_logs CASCADE;
        DROP TABLE IF EXISTS notifications CASCADE;
        DROP TABLE IF EXISTS audit_discrepancies CASCADE;
        DROP TABLE IF EXISTS audit_results CASCADE;
        DROP TABLE IF EXISTS audit_assignments CASCADE;
        DROP TABLE IF EXISTS audit_cycles CASCADE;
        DROP TABLE IF EXISTS maintenance_history CASCADE;
        DROP TABLE IF EXISTS maintenance_requests CASCADE;
        DROP TABLE IF EXISTS booking_history CASCADE;
        DROP TABLE IF EXISTS bookings CASCADE;
        DROP TABLE IF EXISTS allocation_history CASCADE;
        DROP TABLE IF EXISTS asset_transfers CASCADE;
        DROP TABLE IF EXISTS asset_allocations CASCADE;
        DROP TABLE IF EXISTS asset_status_history CASCADE;
        DROP TABLE IF EXISTS asset_attachments CASCADE;
        DROP TABLE IF EXISTS asset_custom_field_values CASCADE;
        DROP TABLE IF EXISTS assets CASCADE;
        DROP TABLE IF EXISTS role_assignment_history CASCADE;
        DROP TABLE IF EXISTS employees CASCADE;
        DROP TABLE IF EXISTS refresh_tokens CASCADE;
        DROP TABLE IF EXISTS password_reset_tokens CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS roles CASCADE;
        DROP TABLE IF EXISTS locations CASCADE;
        DROP TABLE IF EXISTS category_custom_fields CASCADE;
        DROP TABLE IF EXISTS asset_categories CASCADE;
        DROP TABLE IF EXISTS departments CASCADE;
        DROP FUNCTION IF EXISTS fn_sync_asset_status_on_allocation() CASCADE;
        DROP FUNCTION IF EXISTS fn_sync_asset_status_on_maintenance() CASCADE;
        DROP FUNCTION IF EXISTS fn_autogen_audit_discrepancy() CASCADE;
        DROP FUNCTION IF EXISTS fn_close_audit_cycle() CASCADE;
        DROP FUNCTION IF EXISTS fn_backfill_booking_department() CASCADE;
        """
    )

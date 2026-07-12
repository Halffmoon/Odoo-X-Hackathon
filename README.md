# AssetFlow — Backend

Enterprise Asset & Resource Management System API.

**Stack:** FastAPI · SQLAlchemy 2.0 (async / asyncpg) · PostgreSQL (Neon) · Alembic · JWT · Pydantic v2.

## Quick start

See **[docs/SETUP.md](../docs/SETUP.md)** for full, copy-paste setup commands. In short:

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# cp .env.example .env  and fill DATABASE_URL + JWT_SECRET_KEY
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m scripts.bootstrap_admin           # optional: create an ADMIN
.venv/Scripts/python.exe -m scripts.seed_dummy_data           # optional: demo data
.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

Open the interactive docs at **http://127.0.0.1:8000/docs**.

## Architecture

```
app/
├── main.py            # FastAPI app, CORS, exception handlers, router wiring
├── config.py          # pydantic-settings; normalizes the Neon DSN for asyncpg
├── database.py        # async engine + session, get_db dependency
├── dependencies.py    # get_current_user, require_roles(*codes)
├── exceptions.py      # global handlers (IntegrityError→409, etc.)
├── models/            # SQLAlchemy models — mirror the SQL schema exactly
├── schemas/           # Pydantic request/response models
├── routers/           # HTTP layer (status codes, response models)
├── services/          # business logic + DB queries (no raw SQL in routers)
└── utils/             # security (JWT/bcrypt), tag generator, activity log,
                       #   notification helper, file storage
alembic/               # async migrations; 0001 creates the full schema + triggers
scripts/               # bootstrap_admin.py, seed_dummy_data.py
```

**Layering:** routers → services → DB. Routers own HTTP concerns; services own logic and queries. Every write calls `log_activity(...)`; user-facing events call `create_notification(...)`.

**Database automation:** five PostgreSQL triggers keep asset status and discrepancies in sync (allocation ⇄ maintenance ⇄ audit), plus the `v_overdue_allocations` view, the `no_overlapping_bookings` GiST EXCLUDE constraint, and the `uq_one_active_allocation` partial index. All are created in migration `0001_phase1`.

## API reference

The single source of truth for endpoints, request/response shapes, service flows, error codes, trigger effects, and the role-access matrix is **[docs/API_AND_DATA_FLOW.md](../docs/API_AND_DATA_FLOW.md)**.

## Demo credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@assetflow.com` | `admin1234` |
| ASSET_MANAGER | `manager1@assetflow.com` | `password123` |
| DEPT_HEAD | `head.eng@assetflow.com` | `password123` |
| EMPLOYEE | `priya@assetflow.com` | `password123` |

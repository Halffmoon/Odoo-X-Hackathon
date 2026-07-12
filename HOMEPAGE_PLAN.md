# AssetFlow — Dashboard / Home Screen: Frontend Plan

Source: `AssetFlow problem statement.pdf`, Screen 2 — "Dashboard / Home Screen"
Stack assumption: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Prisma (already scaffolded). Adjust Section 1 if a different stack is chosen.

## 1. Goals

- Purpose (from spec): "Give every role a real-time operational snapshot."
- Must work for all 4 roles (Admin, Asset Manager, Department Head, Employee) with role-scoped data, not role-scoped layout — same page, different numbers/actions.
- Professional, responsive, accessible. No placeholder/fake data in the final build — wire to real Prisma-backed API routes.

## 2. Information Architecture (per spec)

**KPI cards** (row of stat tiles):
1. Assets Available
2. Assets Allocated
3. Maintenance Today
4. Active Bookings
5. Pending Transfers
6. Upcoming Returns

**Overdue returns** — assets past Expected Return Date, visually separated (red/warning styling) from "Upcoming Returns."

**Quick actions** — buttons/shortcuts:
- Register Asset (Admin/Asset Manager only)
- Book Resource (all roles)
- Raise Maintenance Request (all roles)

## 3. Layout Plan

```
┌────────────────────────────────────────────────────────┐
│ Topbar: Logo | Org name | Search | Notifications | User │
├───────────┬────────────────────────────────────────────┤
│           │  Page header: "Welcome, {name}" + role badge│
│  Sidebar  │  Quick Actions row (role-gated buttons)     │
│  Nav       ├────────────────────────────────────────────┤
│  (10       │  KPI Card Grid (responsive: 3 cols → 2 → 1)│
│  screens)  ├────────────────────────────────────────────┤
│            │  Overdue Returns panel (warning list)      │
│            ├───────────────────┬────────────────────────┤
│            │ Upcoming Returns  │ Recent Activity feed    │
│            │ / Bookings list   │ (from Screen 10)        │
└───────────┴────────────────────────────────────────────┘
```

Responsive behavior:
- **Desktop (≥1024px):** persistent left sidebar, 3-column KPI grid, 2-column lower panels.
- **Tablet (640–1023px):** collapsible sidebar (icon-only or drawer), 2-column KPI grid, panels stack.
- **Mobile (<640px):** sidebar becomes bottom nav or hamburger drawer, KPI cards stack single-column as horizontally scrollable snap carousel, quick actions become a sticky bottom bar or floating action button (FAB).

## 4. Component Breakdown

| Component | Responsibility |
|---|---|
| `AppShell` | Sidebar + topbar + content slot, handles responsive collapse |
| `KpiCard` | Icon, label, value, trend/delta (optional), loading skeleton state |
| `KpiCardGrid` | Fetches + arranges 6 KPI cards, role-aware (e.g., Employee sees only their own scoped counts) |
| `OverdueReturnsPanel` | Table/list of overdue items, red accent, "days overdue" chip, link to Allocation screen |
| `UpcomingReturnsList` | Same shape, neutral styling, sorted by nearest due date |
| `QuickActionBar` | Buttons that open modals or route to Asset Registration / Resource Booking / Maintenance screens; visibility gated by role |
| `ActivityFeed` | Recent notifications (Asset Assigned, Booking Confirmed, Transfer Approved, etc.) from Screen 10 data, small scrollable list |
| `RoleBadge` | Shows current user's role in header |
| `EmptyState` | Reused for zero-data cases (e.g., no overdue returns — show a positive "All caught up" state, not a blank box) |

## 5. Data Contract (API routes to back the page)

- `GET /api/dashboard/kpis` → `{ available, allocated, maintenanceToday, activeBookings, pendingTransfers, upcomingReturns }` (scoped server-side by session role/department)
- `GET /api/dashboard/overdue` → list of `{ assetTag, assetName, holder, expectedReturnDate, daysOverdue }`
- `GET /api/dashboard/returns?window=upcoming` → same shape, future-dated
- `GET /api/dashboard/activity?limit=10` → recent notification/log entries
- All routes authenticated via session; Employee role gets only their own allocations/bookings, Department Head gets department-scoped, Admin/Asset Manager get org-wide.

## 6. Visual Design System

- **Palette:** neutral base (slate/zinc) + one brand accent color; semantic colors reserved: red/orange for overdue & warnings, green for "available/healthy," amber for "pending approval."
- **Typography:** one sans-serif family (e.g., Inter), clear hierarchy — page title (24–28px semibold), section labels (14px uppercase tracking, muted), KPI values (32–36px bold).
- **Cards:** consistent radius (e.g., `rounded-xl`), subtle border + shadow, hover state only where interactive.
- **Icons:** one icon set throughout (lucide-react) — asset/box icon, calendar icon, wrench icon, arrows for transfers, bell for notifications.
- **Dark mode:** support via Tailwind `dark:` classes from the start (common ERP requirement, cheap to add early, expensive to retrofit).
- **Motion:** minimal — fade/slide-in on card load, skeleton shimmer while fetching, no gratuitous animation.

## 7. States to Design For

- Loading (skeletons for KPI cards and lists)
- Empty (no overdue returns, no bookings today, new org with zero assets)
- Error (API failure → inline retry, not a blank page)
- Role variants: Admin/Asset Manager (org-wide + Register Asset visible) vs Department Head (dept-scoped) vs Employee (personal scope, no Register Asset button)

## 8. Build Steps

1. **Scaffold**: confirm/init Next.js + Tailwind + shadcn/ui on top of existing Prisma setup; set up `AppShell` layout and routing skeleton for all 10 screens (nav links can 404 initially).
2. **Design tokens**: Tailwind theme config (colors, radius, font) + dark mode toggle.
3. **Static layout pass**: build `AppShell`, `KpiCard`, `KpiCardGrid` with mock data, get responsive breakpoints right.
4. **Overdue/Upcoming panels + Activity feed**: static mock data first, styling + empty/loading states.
5. **Quick Actions**: wire routing to stub pages for Register Asset / Book Resource / Raise Maintenance (can be built out later per their own screens).
6. **API routes**: implement the 4 endpoints in section 5 against Prisma schema, with role-based scoping from session.
7. **Wire real data**: replace mocks, add loading/error states, verify numbers match seed data.
8. **Role QA pass**: log in as each of the 4 roles, confirm correct scoping and button visibility.
9. **Responsive QA**: test at 375px, 768px, 1024px, 1440px; verify sidebar collapse and KPI grid reflow.
10. **Accessibility pass**: color contrast on red/amber/green badges, keyboard nav through quick actions, semantic headings.

## 9. Open Questions (confirm with team before/while building)

- Auth/session mechanism (NextAuth vs custom JWT) — affects how role scoping is read on the server.
- Whether notifications are polled or pushed (websocket/SSE) for the Activity Feed — plan can start polling, upgrade later.
- Exact seed data needed for demo (department names, asset counts) so dashboard isn't empty during the hackathon demo.

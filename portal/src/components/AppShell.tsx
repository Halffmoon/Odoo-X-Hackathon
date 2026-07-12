"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth, ROLE_LABEL, type RoleCode } from "@/lib/auth-context";

const NAV: {
  href: string;
  label: string;
  icon: string;
  roles?: RoleCode[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/setup", label: "Organization Setup", icon: "building", roles: ["ADMIN"] },
  { href: "/assets", label: "Assets", icon: "box" },
  { href: "/allocations", label: "Allocation & Transfers", icon: "swap" },
  { href: "/bookings", label: "Resource Booking", icon: "calendar" },
  { href: "/maintenance", label: "Maintenance", icon: "wrench" },
  {
    href: "/audits",
    label: "Audits",
    icon: "check",
    roles: ["ADMIN", "ASSET_MANAGER"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "chart",
    roles: ["ADMIN", "ASSET_MANAGER", "DEPT_HEAD"],
  },
  { href: "/activity", label: "Activity & Notifications", icon: "bell" },
];

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="2" width="7" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 6.5H13.5V14H9.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 4.5H5.5M4.5 7H5.5M4.5 9.5H5.5M4.5 12H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  box: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.6L8 2L14 4.6V11.4L8 14L2 11.4V4.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 4.6L8 7.2M8 7.2L14 4.6M8 7.2V14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  swap: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5H12.5L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10.5H3.5L6 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.3H14.5M4.5 1.5V4M11.5 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  wrench: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10.6 2.2a3.2 3.2 0 0 0-4.2 3.9L2 10.5l1.9 1.9 4.4-4.4a3.2 3.2 0 0 0 3.9-4.2l-2.2 2.2-1.7-1.7 2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 8.2L7 10.7L11.5 5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 14V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 14H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.5 11.5V9M8 11.5V6.5M11.5 11.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2C6 2 4.5 3.5 4.5 5.5V8L3 11H13L11.5 8V5.5C11.5 3.5 10 2 8 2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // Auth guard — bounce unauthenticated visitors to login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="app-shell">
        <main className="app-main flex items-center justify-center">
          <div className="text-[14px] text-text-soft">Loading your workspace…</div>
        </main>
      </div>
    );
  }

  const userName = user.name;
  const role = ROLE_LABEL[user.role_code];
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const visibleNav = NAV.filter(
    (item) => !item.roles || item.roles.includes(user.role_code),
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2.5 text-[15px] font-extrabold tracking-tight no-underline">
          AssetFlow <span className="brand-tag">AF</span>
        </Link>
        <nav className="app-nav" aria-label="Primary">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`app-nav-link ${active ? "active" : ""}`}>
                {ICONS[item.icon]}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => logout()}
          className="app-nav-link mt-auto w-full cursor-pointer border-0 bg-transparent text-left"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3.5C2.7 2 2 2.7 2 3.5v9C2 13.3 2.7 14 3.5 14H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M9.5 11L13 8L9.5 5M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Log out
        </button>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="app-topbar">
          <div className="text-[13.5px] font-medium text-text-soft">
            <span className="hidden sm:inline">Bengaluru HQ ·</span> {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </div>
          <div className="role-pill">
            <span className="avatar">{initials}</span>
            {userName}
            <span className="rtag">· {role}</span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}

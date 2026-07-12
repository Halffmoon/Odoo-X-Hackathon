import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";

const HUES = {
  amber: { c: "var(--hue-amber)", s: "var(--hue-amber-soft)" },
  teal: { c: "var(--hue-teal)", s: "var(--hue-teal-soft)" },
  blue: { c: "var(--hue-blue)", s: "var(--hue-blue-soft)" },
  coral: { c: "var(--hue-coral)", s: "var(--hue-coral-soft)" },
  violet: { c: "var(--hue-violet)", s: "var(--hue-violet-soft)" },
  lime: { c: "var(--hue-lime)", s: "var(--hue-lime-soft)" },
} as const;

const FEATURES = [
  {
    id: "01 · DIRECTORY",
    title: "Departments & employees",
    body: "Set up departments, asset categories, and a searchable employee directory — the master data everything else depends on.",
    hue: "amber",
  },
  {
    id: "02 · LIFECYCLE",
    title: "Flexible asset states",
    body: "Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed — every transition is tracked and timestamped.",
    hue: "teal",
  },
  {
    id: "03 · ALLOCATION",
    title: "Conflict-safe allocation",
    body: "The system blocks double-allocation outright and offers a transfer request instead of a silent failure.",
    hue: "blue",
  },
  {
    id: "04 · BOOKING",
    title: "Shared resource booking",
    body: "Time-slot booking for rooms, vehicles, and equipment with automatic overlap validation.",
    hue: "coral",
  },
  {
    id: "05 · MAINTENANCE",
    title: "Approval-gated repairs",
    body: "Requests route through approval before work starts; asset status flips automatically at each stage.",
    hue: "violet",
  },
  {
    id: "06 · AUDIT",
    title: "Structured audit cycles",
    body: "Assign auditors, verify assets, auto-generate discrepancy reports, and close the cycle with confidence.",
    hue: "lime",
  },
] as const;

const WORKFLOW = [
  {
    n: "1",
    title: "Set up the org",
    body: "Admin creates departments, asset categories, and promotes Department Heads & Asset Managers from the directory.",
    hue: "amber",
  },
  {
    n: "2",
    title: "Register assets",
    body: "Asset Managers register new assets — each enters the system as Available with an auto-generated tag.",
    hue: "teal",
  },
  {
    n: "3",
    title: "Allocate or book",
    body: "Assets go to employees or departments; shared resources are booked by time slot with overlaps rejected automatically.",
    hue: "blue",
  },
  {
    n: "4",
    title: "Maintain & transfer",
    body: "Repairs route through approval before work begins; overdue returns are flagged automatically.",
    hue: "coral",
  },
  {
    n: "5",
    title: "Audit & report",
    body: "Periodic cycles assign auditors, verify holdings, and auto-generate discrepancy reports before closing.",
    hue: "violet",
  },
] as const;

const ROLES = [
  {
    name: "Admin",
    items: ["Departments & categories", "Audit cycles", "Role assignment", "Org-wide analytics"],
    hue: "amber",
  },
  {
    name: "Asset Manager",
    items: ["Register & allocate assets", "Approve transfers", "Approve returns", "Resolve discrepancies"],
    hue: "teal",
  },
  {
    name: "Department Head",
    items: ["View department assets", "Approve dept. requests", "Book shared resources"],
    hue: "blue",
  },
  {
    name: "Employee",
    items: ["View own assets", "Book resources", "Raise maintenance", "Request transfers"],
    hue: "coral",
  },
] as const;

const CAPABILITIES = [
  "Asset lifecycle",
  "Resource booking",
  "Maintenance approvals",
  "Audit cycles",
  "Role-based access",
  "Real-time notifications",
];

const FAQS = [
  {
    q: "Does AssetFlow handle purchasing or invoicing?",
    a: "No — by design. AssetFlow focuses on the asset and resource lifecycle: registration, allocation, booking, maintenance, and audit. Purchasing and accounting stay in the tools you already use.",
  },
  {
    q: "How does AssetFlow stop the same asset being allocated twice?",
    a: "Every allocation checks the asset's current holder server-side. If it's already assigned, the request is blocked outright and you're offered a Transfer Request instead of a silent conflict.",
  },
  {
    q: "Can employees make themselves an Admin?",
    a: "No. Signup only ever creates an Employee account. Department Head and Asset Manager roles are granted by an Admin from the Employee Directory — never self-assigned.",
  },
  {
    q: "What happens when a shared resource is double-booked?",
    a: "Bookings are validated by time slot. A request that overlaps an existing booking is rejected immediately, with the conflicting slot shown back to the requester.",
  },
  {
    q: "How are audits closed out?",
    a: "An Admin assigns auditors to a cycle scoped by department or location. Auditors mark each asset Verified, Missing, or Damaged; closing the cycle locks it and auto-updates affected asset statuses.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main id="top">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-line px-5 py-16 sm:px-8 sm:py-24">
          <div className="hero-blob" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
            <div>
              <span className="eyebrow fade-up" style={{ ["--d" as string]: "0s" }}>
                Enterprise Asset &amp; Resource Management
              </span>
              <h1 className="fade-up mt-4 text-[34px] leading-[1.03] sm:text-[46px] lg:text-[58px]" style={{ ["--d" as string]: "0.08s" }}>
                Know who holds <em className="not-italic text-accent">what</em>,<br />
                where, and in what condition.
              </h1>
              <p className="fade-up mt-5 max-w-[52ch] text-[17px] leading-relaxed text-text-soft" style={{ ["--d" as string]: "0.16s" }}>
                AssetFlow replaces spreadsheets and paper logs with one system of record —
                asset lifecycles, resource bookings, maintenance approvals, and audit cycles,
                tracked in real time across every department.
              </p>
              <div className="fade-up mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "0.24s" }}>
                <Link href="/signup" className="btn btn-accent btn-lg">
                  Create free account
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  Log in
                </Link>
              </div>
              <div className="fade-up mt-9 flex flex-wrap gap-7" style={{ ["--d" as string]: "0.32s" }}>
                <div className="font-mono text-xs text-muted">
                  <strong className="block text-xl font-extrabold" style={{ color: "var(--hue-blue)" }}>6</strong>
                  live KPI signals
                </div>
                <div className="font-mono text-xs text-muted">
                  <strong className="block text-xl font-extrabold" style={{ color: "var(--hue-coral)" }}>0</strong>
                  double-allocations, ever
                </div>
                <div className="font-mono text-xs text-muted">
                  <strong className="block text-xl font-extrabold" style={{ color: "var(--hue-teal)" }}>4</strong>
                  role-scoped workspaces
                </div>
              </div>
            </div>

            <Reveal>
              <div className="dash">
                <div className="dash-bar">
                  <span className="dash-dot" />
                  <span className="dash-dot" />
                  <span className="dash-dot" />
                  <span className="dash-title">dashboard · overview</span>
                </div>
                <div className="dash-body">
                  <div className="dash-kpis">
                    <div className="dash-kpi">
                      <div className="n">128</div>
                      <div className="l">Available</div>
                    </div>
                    <div className="dash-kpi">
                      <div className="n">342</div>
                      <div className="l">Allocated</div>
                    </div>
                    <div className="dash-kpi">
                      <div className="n">6</div>
                      <div className="l">Maint. today</div>
                    </div>
                  </div>
                  <div className="dash-table">
                    <div className="dash-row head">
                      <span>Asset</span>
                      <span>Holder</span>
                      <span>Status</span>
                    </div>
                    <div className="dash-row">
                      <span className="tag">AF-0114 · Laptop</span>
                      <span>Priya Nair</span>
                      <span className="chip chip-allocated">Allocated</span>
                    </div>
                    <div className="dash-row">
                      <span className="tag">AF-0092 · Room B2</span>
                      <span>9:00–10:00</span>
                      <span className="chip chip-booked">Booked</span>
                    </div>
                    <div className="dash-row">
                      <span className="tag">AF-0037 · Projector</span>
                      <span>Unassigned</span>
                      <span className="chip chip-available">Available</span>
                    </div>
                  </div>
                  <div className="mock-foot" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                    <span className="pulse" /> Synced 3s ago · full history logged
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CAPABILITY STRIP */}
        <section className="px-5 sm:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="cap-strip">
              {CAPABILITIES.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        </section>

        {/* KPI STRIP */}
        <section className="px-5 py-14 sm:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Reveal>
              <div className="kpi-strip">
                <div className="kpi">
                  <div className="num" style={{ color: "var(--hue-teal)" }}>128</div>
                  <div className="lbl">Assets available</div>
                </div>
                <div className="kpi">
                  <div className="num" style={{ color: "var(--hue-amber)" }}>342</div>
                  <div className="lbl">Assets allocated</div>
                </div>
                <div className="kpi">
                  <div className="num" style={{ color: "var(--hue-coral)" }}>6</div>
                  <div className="lbl">Maintenance today</div>
                </div>
                <div className="kpi">
                  <div className="num" style={{ color: "var(--hue-blue)" }}>19</div>
                  <div className="lbl">Active bookings</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="px-5 py-16 sm:px-8 sm:py-22">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="eyebrow">What it does</span>
                <h2 className="mt-3 text-[26px] sm:text-[36px]">One platform, the full asset lifecycle.</h2>
              </div>
              <p className="max-w-[44ch] text-[15px] text-text-soft">
                From registration to retirement — allocation, booking, maintenance, and audit
                run through the same source of truth.
              </p>
            </div>
            <div className="feature-grid">
              {FEATURES.map((f, i) => (
                <Reveal key={f.id} style={{ transitionDelay: `${i * 60}ms` }}>
                  <div
                    className="feature"
                    style={
                      {
                        "--f-color": HUES[f.hue].c,
                        "--f-soft": HUES[f.hue].s,
                      } as React.CSSProperties
                    }
                  >
                    <span className="fid">{f.id}</span>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="workflow" className="border-t border-line px-5 py-16 sm:px-8 sm:py-22">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-11">
              <span className="eyebrow">How it works</span>
              <h2 className="mt-3 text-[26px] sm:text-[36px]">From setup to closed audit.</h2>
            </div>
            <div className="rail">
              <div className="rail-line" />
              {WORKFLOW.map((w, i) => (
                <Reveal key={w.n} style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className="rail-item">
                    <div className="rail-dot" style={{ ["--w-color" as string]: HUES[w.hue].c }}>
                      {w.n}
                    </div>
                    <div>
                      <strong>{w.title}</strong>
                      <p>{w.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ROLES */}
        <section id="roles" className="border-t border-line px-5 py-16 sm:px-8 sm:py-22">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="eyebrow">Built for every role</span>
                <h2 className="mt-3 text-[26px] sm:text-[36px]">One workspace, scoped to each seat.</h2>
              </div>
              <p className="max-w-[44ch] text-[15px] text-text-soft">
                No self-elevated admin roles — accounts start as Employee, and permissions are
                granted deliberately from the directory.
              </p>
            </div>
            <div className="role-grid">
              {ROLES.map((r, idx) => (
                <Reveal key={r.name} style={{ transitionDelay: `${idx * 70}ms` }}>
                  <div className="role-card" style={{ ["--r-color" as string]: HUES[r.hue].c }}>
                    <span className="rname">
                      <span className="rdot" />
                      {r.name}
                    </span>
                    <ul>
                      {r.items.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="border-t border-line px-5 py-16 sm:px-8 sm:py-22">
          <Reveal>
            <div className="mx-auto max-w-[720px]">
              <span className="eyebrow">About us</span>
              <h2 className="mt-3 text-[24px] sm:text-[32px]">Built to replace the spreadsheet.</h2>
              <p className="mt-4 text-[15.5px] leading-loose text-text-soft">
                AssetFlow started from a simple observation: most organizations — schools,
                hospitals, factories, agencies — still track physical assets and shared spaces
                on spreadsheets and paper logs. That works until it doesn&apos;t: assets go
                missing, bookings collide, and maintenance falls through the cracks. We built
                AssetFlow as a clean, role-based ERP module focused on one job — asset and
                resource lifecycle — done well, without dragging in purchasing or accounting
                concerns it was never meant to solve.
              </p>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line px-5 py-16 sm:px-8 sm:py-22">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-11">
              <span className="eyebrow">Questions</span>
              <h2 className="mt-3 text-[26px] sm:text-[36px]">Before you set up your org.</h2>
            </div>
            <Reveal>
              <div>
                {FAQS.map((f) => (
                  <details key={f.q} className="faq-item">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA BAND */}
        <section className="border-t border-line px-5 py-16 sm:px-8 sm:py-22">
          <div className="mx-auto max-w-[1180px]">
            <Reveal>
              <div className="cta-band">
                <div>
                  <h2>Ready to see what your organization actually owns?</h2>
                  <p>Set up your workspace in minutes — no credit card, no procurement call.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/signup" className="btn btn-solid btn-lg">
                    Create free account
                  </Link>
                  <Link href="/login" className="btn btn-ghost btn-lg">
                    Log in
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contact" className="border-t border-line px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="foot-grid grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            <div>
              <div className="mb-2.5 flex items-center gap-2.5 text-lg font-extrabold">
                AssetFlow <span className="brand-tag">AF</span>
              </div>
              <p className="max-w-[32ch] text-[13.5px] leading-relaxed text-text-soft">
                Enterprise asset &amp; resource management, for any organization with something
                to track.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#workflow">How it works</a>
                </li>
                <li>
                  <a href="#roles">Roles</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li>
                  <a href="#about">About us</a>
                </li>
                <li>
                  <a href="#contact">Contact us</a>
                </li>
                <li>
                  <Link href="/signup">Get started</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>Contact us</h4>
              <ul>
                <li>
                  <a href="mailto:hello@assetflow.app" className="font-mono">
                    hello@assetflow.app
                  </a>
                </li>
                <li>
                  <a href="tel:+919876543210" className="font-mono">
                    +91 98765 43210
                  </a>
                </li>
                <li className="text-[13.5px] text-text-soft">Bengaluru, India</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12.5px] text-muted">
            <span className="font-mono">© 2026 AssetFlow. Built for the Odoo x Hackathon.</span>
            <span className="font-mono">v0.1 · manifest-01</span>
          </div>
        </div>
      </footer>
    </>
  );
}

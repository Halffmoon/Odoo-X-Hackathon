import Link from "next/link";
import AppShell from "@/components/AppShell";

const CURRENT_USER = { name: "Arjun Mehta", role: "Asset Manager" };

const MY_ASSETS = ["AF-0114 · Dell Latitude 5440", "AF-0037 · Projector", "AF-0201 · Ergo Chair — Type B"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export default function RaiseMaintenancePage() {
  return (
    <AppShell userName={CURRENT_USER.name} role={CURRENT_USER.role}>
      <Link href="/dashboard" className="eyebrow no-underline">
        ← Dashboard
      </Link>

      <div className="mt-3">
        <h1 className="text-[26px] sm:text-[30px]">Raise Maintenance Request</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
          Report a fault on an asset you hold. It routes to an Asset Manager for approval before repair work starts and before the
          asset flips to <strong style={{ color: "var(--hue-coral)" }}>Under Maintenance</strong>.
        </p>
      </div>

      <form className="mt-8 flex max-w-[560px] flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Asset
          <select className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]">
            {MY_ASSETS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Priority
          <select className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]">
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Describe the issue
          <textarea
            rows={4}
            placeholder="What's wrong with it?"
            className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Attach photo
          <input
            type="file"
            className="rounded-[2px] border border-dashed border-line bg-paper-raised px-3.5 py-4 text-[13px] text-text-soft outline-none file:mr-3 file:rounded-[2px] file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-paper"
          />
        </label>

        <div className="mt-2 flex gap-3">
          <button type="submit" className="btn btn-accent btn-lg">
            Submit request
          </button>
          <Link href="/dashboard" className="btn btn-ghost btn-lg">
            Cancel
          </Link>
        </div>
      </form>
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { assetsApi } from "@/lib/api/assets";
import { maintenanceApi, type Priority } from "@/lib/api/maintenance";

const inputCls =
  "rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-blue)]";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export default function RaiseMaintenancePage() {
  const router = useRouter();
  const { success } = useToast();

  const assetsState = useApi((s) => assetsApi.list({ page_size: 200 }, s));
  const assets = assetsState.data?.items ?? [];

  const [assetId, setAssetId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [issue, setIssue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!assetId) return setError("Select an asset.");
    if (!issue.trim()) return setError("Describe the issue.");
    setSubmitting(true);
    try {
      await maintenanceApi.create({ asset_id: assetId, issue_description: issue.trim(), priority });
      success("Maintenance request submitted.");
      router.push("/maintenance");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit request.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <Link href="/maintenance" className="eyebrow no-underline">← Maintenance</Link>

      <div className="mt-3">
        <h1 className="text-[26px] sm:text-[30px]">Raise Maintenance Request</h1>
        <p className="mt-1.5 max-w-[52ch] text-[14px] text-text-soft">
          Report a fault on an asset. It routes to an Asset Manager for approval before repair work starts and before the
          asset flips to <strong style={{ color: "var(--hue-coral)" }}>Under Maintenance</strong>.
        </p>
      </div>

      <form className="mt-8 flex max-w-[560px] flex-col gap-4" onSubmit={onSubmit}>
        {error && (
          <div className="rounded-[2px] border border-[color:var(--hue-coral)] bg-[color-mix(in_srgb,var(--hue-coral)_10%,transparent)] px-3.5 py-2.5 text-[13px] text-[color:var(--hue-coral)]">
            {error}
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Asset
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputCls} required>
            <option value="">{assetsState.loading ? "Loading…" : "— select asset —"}</option>
            {assets.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_tag} · {a.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={inputCls}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Describe the issue
          <textarea rows={4} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What's wrong with it?" className={inputCls} required />
        </label>

        <div className="mt-2 flex gap-3">
          <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>
          <Link href="/maintenance" className="btn btn-ghost btn-lg">Cancel</Link>
        </div>
      </form>
    </AppShell>
  );
}

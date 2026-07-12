import { apiClient } from "../api-client";
import type { Paginated } from "./types";

export type MaintenanceStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "TECHNICIAN_ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Maintenance {
  maintenance_id: string;
  asset_id: string;
  asset_tag: string | null;
  asset_name: string | null;
  requested_by: string;
  requester_name: string | null;
  issue_description: string;
  priority: Priority;
  status: MaintenanceStatus;
  approved_by: string | null;
  approved_on: string | null;
  technician_id: string | null;
  technician_name: string | null;
  resolved_on: string | null;
  resolution_notes: string | null;
  created_on: string;
  updated_on: string;
}

export const maintenanceApi = {
  list: (params?: { status?: string; priority?: string; page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiClient.get<Paginated<Maintenance>>("/maintenance", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  create: (body: { asset_id: string; issue_description: string; priority?: Priority }) =>
    apiClient.post<Maintenance>("/maintenance", body),
  approve: (id: string) => apiClient.post<Maintenance>(`/maintenance/${id}/approve`, {}),
  reject: (id: string, reason?: string) => apiClient.post<Maintenance>(`/maintenance/${id}/reject`, { reason: reason ?? null }),
  assignTechnician: (id: string, technician_id: string) =>
    apiClient.post<Maintenance>(`/maintenance/${id}/assign-technician`, { technician_id }),
  start: (id: string) => apiClient.post<Maintenance>(`/maintenance/${id}/start`, {}),
  resolve: (id: string, resolution_notes?: string) =>
    apiClient.post<Maintenance>(`/maintenance/${id}/resolve`, { resolution_notes: resolution_notes ?? null }),
};

export const MAINT_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  TECHNICIAN_ASSIGNED: "Tech assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const MAINT_STATUS_STYLE: Record<MaintenanceStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
  APPROVED: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  REJECTED: { bg: "color-mix(in srgb, var(--hue-coral) 14%, transparent)", fg: "var(--hue-coral)" },
  TECHNICIAN_ASSIGNED: { bg: "var(--hue-violet-soft)", fg: "var(--hue-violet)" },
  IN_PROGRESS: { bg: "color-mix(in srgb, var(--accent) 14%, transparent)", fg: "var(--accent)" },
  RESOLVED: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
};

export const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string }> = {
  LOW: { bg: "color-mix(in srgb, var(--muted) 14%, transparent)", fg: "var(--muted)" },
  MEDIUM: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  HIGH: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
  CRITICAL: { bg: "color-mix(in srgb, var(--hue-coral) 16%, transparent)", fg: "var(--hue-coral)" },
};

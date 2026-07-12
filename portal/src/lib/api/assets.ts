import { apiClient } from "../api-client";
import type { Paginated } from "./types";

export type AssetStatus =
  | "AVAILABLE"
  | "ALLOCATED"
  | "RESERVED"
  | "UNDER_MAINTENANCE"
  | "LOST"
  | "RETIRED"
  | "DISPOSED";

export type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED";

export interface Asset {
  asset_id: string;
  asset_tag: string;
  name: string;
  category_id: string;
  category_name: string | null;
  serial_number: string | null;
  acquisition_date: string | null;
  acquisition_cost: string | number | null;
  condition: AssetCondition;
  location_id: string | null;
  location_name: string | null;
  current_department_id: string | null;
  department_name: string | null;
  is_bookable: boolean;
  status: AssetStatus;
  qr_code: string | null;
  created_on: string;
  updated_on: string;
}

export interface AssetCreate {
  name: string;
  category_id: string;
  serial_number?: string | null;
  acquisition_date?: string | null;
  acquisition_cost?: number | null;
  condition?: AssetCondition;
  location_id?: string | null;
  current_department_id?: string | null;
  is_bookable?: boolean;
  qr_code?: string | null;
}

export interface AssetListParams {
  q?: string;
  serial_number?: string;
  category_id?: string;
  status?: AssetStatus;
  department_id?: string;
  location_id?: string;
  is_bookable?: boolean;
  page?: number;
  page_size?: number;
}

export interface AssetHistoryEvent {
  event_type: "ALLOCATION" | "MAINTENANCE";
  action: string;
  performed_on: string;
  performed_by: string | null;
  reference_id: string;
  details: Record<string, unknown> | null;
}

export const assetsApi = {
  list: (params?: AssetListParams, signal?: AbortSignal) =>
    apiClient.get<Paginated<Asset>>("/assets", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<Asset>(`/assets/${id}`, { signal }),
  create: (body: AssetCreate) => apiClient.post<Asset>("/assets", body),
  updateStatus: (id: string, new_status: AssetStatus, reason?: string) =>
    apiClient.patch<Asset>(`/assets/${id}/status`, { new_status, reason }),
  history: (id: string, signal?: AbortSignal) =>
    apiClient.get<AssetHistoryEvent[]>(`/assets/${id}/history`, { signal }),
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: "Available",
  ALLOCATED: "Allocated",
  RESERVED: "Reserved",
  UNDER_MAINTENANCE: "Under Maintenance",
  LOST: "Lost",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
};

export const ASSET_STATUS_HUE: Record<AssetStatus, { bg: string; fg: string }> = {
  AVAILABLE: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  ALLOCATED: { bg: "color-mix(in srgb, var(--accent) 14%, transparent)", fg: "var(--accent)" },
  RESERVED: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  UNDER_MAINTENANCE: { bg: "var(--hue-violet-soft)", fg: "var(--hue-violet)" },
  LOST: { bg: "color-mix(in srgb, var(--hue-coral) 16%, transparent)", fg: "var(--hue-coral)" },
  RETIRED: { bg: "color-mix(in srgb, var(--muted) 16%, transparent)", fg: "var(--muted)" },
  DISPOSED: { bg: "color-mix(in srgb, var(--muted) 10%, transparent)", fg: "var(--muted)" },
};

export const ASSET_STATUS_ORDER: AssetStatus[] = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
];

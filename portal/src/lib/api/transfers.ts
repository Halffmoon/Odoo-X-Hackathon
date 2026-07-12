import { apiClient } from "../api-client";
import type { Paginated } from "./types";

export type TransferStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface Transfer {
  transfer_id: string;
  asset_id: string;
  asset_tag: string | null;
  from_employee_id: string | null;
  from_employee_name: string | null;
  to_employee_id: string;
  to_employee_name: string | null;
  requested_by: string;
  approved_by: string | null;
  status: TransferStatus;
  requested_on: string;
  approved_on: string | null;
  completed_on: string | null;
  remarks: string | null;
}

export interface TransferCreate {
  asset_id: string;
  to_employee_id: string;
  remarks?: string | null;
}

export const transfersApi = {
  list: (params?: { asset_id?: string; status?: TransferStatus; page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiClient.get<Paginated<Transfer>>("/transfers", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  create: (body: TransferCreate) => apiClient.post<Transfer>("/transfers", body),
  approve: (id: string, remarks?: string) =>
    apiClient.post<Transfer>(`/transfers/${id}/approve`, { remarks: remarks ?? null }),
  reject: (id: string, remarks?: string) =>
    apiClient.post<Transfer>(`/transfers/${id}/reject`, { remarks: remarks ?? null }),
};

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const TRANSFER_STATUS_STYLE: Record<TransferStatus, { bg: string; fg: string }> = {
  REQUESTED: { bg: "var(--hue-amber-soft)", fg: "var(--hue-amber)" },
  APPROVED: { bg: "var(--hue-blue-soft)", fg: "var(--hue-blue)" },
  COMPLETED: { bg: "color-mix(in srgb, var(--verify) 14%, transparent)", fg: "var(--verify)" },
  REJECTED: { bg: "color-mix(in srgb, var(--hue-coral) 14%, transparent)", fg: "var(--hue-coral)" },
};

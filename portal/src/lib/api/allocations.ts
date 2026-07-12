import { apiClient } from "../api-client";
import type { Paginated } from "./types";
import type { AssetCondition } from "./assets";

export type AllocationStatus = "ACTIVE" | "RETURNED";

export interface Allocation {
  allocation_id: string;
  asset_id: string;
  asset_tag: string | null;
  asset_name: string | null;
  employee_id: string | null;
  employee_name: string | null;
  department_id: string | null;
  department_name: string | null;
  allocation_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  return_condition: string | null;
  return_notes: string | null;
  status: AllocationStatus;
  days_overdue: number | null;
}

export interface AllocationCreate {
  asset_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  expected_return_date?: string | null;
}

export interface AllocationListParams {
  asset_id?: string;
  employee_id?: string;
  department_id?: string;
  status?: AllocationStatus;
  page?: number;
  page_size?: number;
}

export const allocationsApi = {
  list: (params?: AllocationListParams, signal?: AbortSignal) =>
    apiClient.get<Paginated<Allocation>>("/allocations", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  create: (body: AllocationCreate) =>
    apiClient.post<Allocation>("/allocations", body),
  return: (id: string, return_condition: AssetCondition, return_notes?: string) =>
    apiClient.post<Allocation>(`/allocations/${id}/return`, {
      return_condition,
      return_notes: return_notes ?? null,
    }),
};

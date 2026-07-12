import { apiClient } from "../api-client";

export interface UpcomingReturn {
  allocation_id: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  employee_id: string | null;
  expected_return_date: string;
  days_until_due: number;
}

export interface DashboardKPIs {
  scope: "GLOBAL" | "DEPARTMENT" | "SELF";
  assets_available: number;
  assets_allocated: number;
  maintenance_today: number;
  active_bookings: number;
  pending_transfers: number;
  overdue_returns: number;
  upcoming_returns: UpcomingReturn[];
}

export interface OverdueAllocation {
  allocation_id: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  employee_id: string | null;
  department_id: string | null;
  expected_return_date: string;
  days_overdue: number;
}

export const dashboardApi = {
  kpis: (signal?: AbortSignal) =>
    apiClient.get<DashboardKPIs>("/dashboard/kpis", { signal }),
  overdue: (signal?: AbortSignal) =>
    apiClient.get<OverdueAllocation[]>("/allocations/overdue", { signal }),
};

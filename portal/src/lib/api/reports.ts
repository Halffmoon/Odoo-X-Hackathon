import { apiClient, API_BASE_URL } from "../api-client";
import { getAccessToken } from "../auth-store";

export interface UtilizationRow {
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  allocation_count: number;
  total_allocation_days: number;
}

export interface MaintenanceFrequencyRow {
  asset_id: string;
  asset_tag: string;
  category_id: string | null;
  category_name: string | null;
  request_count: number;
  avg_resolution_hours: number | null;
}

export interface DepartmentSummaryRow {
  department_id: string | null;
  department_name: string | null;
  total_assets: number;
  allocated: number;
  available: number;
  under_maintenance: number;
}

export interface RetirementForecastRow {
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  condition: string;
  acquisition_date: string | null;
  reason: string;
}

export interface BookingHeatmap {
  matrix: number[][];
}

export const reportsApi = {
  utilization: (signal?: AbortSignal) => apiClient.get<UtilizationRow[]>("/reports/utilization", { signal }),
  maintenanceFrequency: (signal?: AbortSignal) => apiClient.get<MaintenanceFrequencyRow[]>("/reports/maintenance-frequency", { signal }),
  departmentSummary: (signal?: AbortSignal) => apiClient.get<DepartmentSummaryRow[]>("/reports/department-summary", { signal }),
  retirementForecast: (signal?: AbortSignal) => apiClient.get<RetirementForecastRow[]>("/reports/retirement-forecast", { signal }),
  bookingHeatmap: (signal?: AbortSignal) => apiClient.get<BookingHeatmap>("/reports/booking-heatmap", { signal }),
  /** Downloads an export and triggers a browser save. */
  export: async (type: string, format: "xlsx" | "pdf" = "xlsx") => {
    const url = `${API_BASE_URL.replace(/\/$/, "")}/reports/export?type=${encodeURIComponent(type)}&format=${format}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `${type}.${format}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

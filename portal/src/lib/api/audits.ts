import { apiClient } from "../api-client";

export interface AuditProgress {
  total_in_scope: number;
  verified: number;
  missing: number;
  damaged: number;
  recorded: number;
}

export interface AuditCycle {
  audit_cycle_id: string;
  name: string;
  department_id: string | null;
  location_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  closed_by: string | null;
  closed_on: string | null;
  created_on: string;
  progress: AuditProgress;
  auditor_employee_ids: string[];
}

export interface AuditCycleCreate {
  name: string;
  department_id?: string | null;
  location_id?: string | null;
  start_date: string;
  end_date: string;
  auditor_employee_ids?: string[];
}

export interface AuditResult {
  audit_result_id: string;
  audit_cycle_id: string;
  asset_id: string;
  auditor_employee_id: string;
  finding: string;
  remarks: string | null;
  recorded_on: string;
}

export interface Discrepancy {
  discrepancy_id: string;
  audit_result_id: string;
  audit_cycle_id: string;
  asset_id: string;
  asset_tag: string | null;
  finding: string;
  status: string;
  resolved_by: string | null;
  resolved_on: string | null;
  resolution_notes: string | null;
}

export const auditsApi = {
  listCycles: (status?: string, signal?: AbortSignal) =>
    apiClient.get<AuditCycle[]>("/audits", { params: { status }, signal }),
  createCycle: (body: AuditCycleCreate) => apiClient.post<AuditCycle>("/audits", body),
  closeCycle: (id: string) => apiClient.post<AuditCycle>(`/audits/${id}/close`, {}),
  results: (id: string, signal?: AbortSignal) =>
    apiClient.get<AuditResult[]>(`/audits/${id}/results`, { signal }),
  recordFinding: (id: string, body: { asset_id: string; finding: string; remarks?: string | null }) =>
    apiClient.post<AuditResult>(`/audits/${id}/results`, body),
};

export const discrepanciesApi = {
  list: (status?: string, signal?: AbortSignal) =>
    apiClient.get<Discrepancy[]>("/discrepancies", { params: { status }, signal }),
  resolve: (id: string, resolution_notes?: string) =>
    apiClient.post<Discrepancy>(`/discrepancies/${id}/resolve`, { resolution_notes: resolution_notes ?? null }),
};

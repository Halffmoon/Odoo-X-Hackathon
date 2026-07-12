import { apiClient } from "../api-client";

export interface Department {
  department_id: string;
  name: string;
  parent_department_id: string | null;
  head_employee_id: string | null;
  status: string;
  created_on: string;
  updated_on: string;
}

export interface DepartmentCreate {
  name: string;
  parent_department_id?: string | null;
  head_employee_id?: string | null;
}

export interface DepartmentUpdate {
  name?: string;
  parent_department_id?: string | null;
  head_employee_id?: string | null;
  status?: string;
}

export const departmentsApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get<Department[]>("/departments", { signal }),
  create: (body: DepartmentCreate) =>
    apiClient.post<Department>("/departments", body),
  update: (id: string, body: DepartmentUpdate) =>
    apiClient.put<Department>(`/departments/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<{ message: string }>(`/departments/${id}`),
};

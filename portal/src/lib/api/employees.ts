import { apiClient } from "../api-client";

export interface Employee {
  employee_id: string;
  user_id: string;
  employee_code: string;
  name: string;
  email: string;
  phone: string | null;
  role_id: number;
  role_code: string;
  department_id: string | null;
  department_name: string | null;
  status: string;
  created_on: string;
}

export interface EmployeeUpdate {
  name?: string;
  phone?: string | null;
  department_id?: string | null;
  status?: string;
}

export const employeesApi = {
  list: (
    params?: { department_id?: string; role_code?: string; status?: string },
    signal?: AbortSignal,
  ) => apiClient.get<Employee[]>("/employees", { params, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<Employee>(`/employees/${id}`, { signal }),
  update: (id: string, body: EmployeeUpdate) =>
    apiClient.put<Employee>(`/employees/${id}`, body),
  promote: (id: string, new_role_code: string) =>
    apiClient.post<Employee>(`/employees/${id}/promote`, { new_role_code }),
  remove: (id: string) =>
    apiClient.delete<{ message: string }>(`/employees/${id}`),
};

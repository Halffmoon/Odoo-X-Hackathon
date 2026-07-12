import { apiClient } from "../api-client";

export interface Category {
  category_id: string;
  name: string;
  description: string | null;
  status: string;
  created_on: string;
  updated_on: string;
}

export interface CategoryCreate {
  name: string;
  description?: string | null;
}

export interface CategoryUpdate {
  name?: string;
  description?: string | null;
  status?: string;
}

export interface CustomField {
  field_id: string;
  category_id: string;
  field_name: string;
  field_type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN";
  is_required: boolean;
}

export interface CustomFieldCreate {
  field_name: string;
  field_type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN";
  is_required?: boolean;
}

export const categoriesApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get<Category[]>("/categories", { signal }),
  create: (body: CategoryCreate) =>
    apiClient.post<Category>("/categories", body),
  update: (id: string, body: CategoryUpdate) =>
    apiClient.put<Category>(`/categories/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<{ message: string }>(`/categories/${id}`),
  fields: (id: string, signal?: AbortSignal) =>
    apiClient.get<CustomField[]>(`/categories/${id}/fields`, { signal }),
  addField: (id: string, body: CustomFieldCreate) =>
    apiClient.post<CustomField>(`/categories/${id}/fields`, body),
  removeField: (id: string, fieldId: string) =>
    apiClient.delete<{ message: string }>(`/categories/${id}/fields/${fieldId}`),
};

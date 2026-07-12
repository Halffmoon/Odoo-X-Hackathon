import { apiClient } from "../api-client";

export interface Location {
  location_id: string;
  name: string;
  address: string | null;
  status: string;
  created_on: string;
  updated_on: string;
}

export const locationsApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get<Location[]>("/locations", { signal }),
  create: (body: { name: string; address?: string | null }) =>
    apiClient.post<Location>("/locations", body),
};

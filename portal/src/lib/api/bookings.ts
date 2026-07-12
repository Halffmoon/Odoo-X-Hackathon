import { apiClient } from "../api-client";
import type { Paginated } from "./types";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface Booking {
  booking_id: string;
  asset_id: string;
  asset_name: string | null;
  employee_id: string;
  employee_name: string | null;
  department_id: string | null;
  department_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;
}

export interface TimeSlot {
  start: string;
  end: string;
  booked_by: string | null;
  booking_id: string | null;
}

export interface Availability {
  asset_id: string;
  date: string;
  booked_slots: TimeSlot[];
  free_slots: TimeSlot[];
}

export const bookingsApi = {
  list: (
    params?: { asset_id?: string; employee_id?: string; status?: string; page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiClient.get<Paginated<Booking>>("/bookings", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  availability: (asset_id: string, date: string, signal?: AbortSignal) =>
    apiClient.get<Availability>("/bookings/availability", { params: { asset_id, date }, signal }),
  create: (body: { asset_id: string; start_time: string; end_time: string; purpose?: string | null }) =>
    apiClient.post<Booking>("/bookings", body),
  cancel: (id: string) => apiClient.post<Booking>(`/bookings/${id}/cancel`, {}),
};

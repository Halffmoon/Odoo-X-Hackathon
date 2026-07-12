import { apiClient } from "../api-client";

export interface Notification {
  notification_id: string;
  recipient_employee_id: string;
  type: string;
  title: string;
  message: string;
  reference_table: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_on: string;
}

export interface NotificationList {
  unread_count: number;
  total: number;
  items: Notification[];
}

export interface ActivityLog {
  log_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_table: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_on: string;
}

export const notificationsApi = {
  list: (params?: { is_read?: boolean; limit?: number; offset?: number }, signal?: AbortSignal) =>
    apiClient.get<NotificationList>("/notifications", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
  markRead: (id: string) => apiClient.post<Notification>(`/notifications/${id}/read`, {}),
  markAllRead: () => apiClient.post<{ message: string }>("/notifications/read-all", {}),
};

export const logsApi = {
  list: (params?: { entity_table?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    apiClient.get<ActivityLog[]>("/logs", {
      params: params as Record<string, string | number | boolean | undefined | null>,
      signal,
    }),
};

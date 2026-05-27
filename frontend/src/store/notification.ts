import { create } from 'zustand';
import apiClient from '../api/client';
import { getAccessToken } from './auth';

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  status: string;
  created_at: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  loading: boolean;
  wsConnected: boolean;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,
  wsConnected: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ loading: true });
    try {
      const { data } = await apiClient.get('/notifications', {
        params: { unread_only: unreadOnly, limit: 20 },
      });
      set({
        notifications: data.items || [],
        unreadCount: data.unread_count || 0,
        total: data.total || 0,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      const { notifications } = get();
      set({
        notifications: notifications.map((n) =>
          n.id === id ? { ...n, status: 'READ' } : n
        ),
        unreadCount: Math.max(0, get().unreadCount - 1),
      });
    } catch {}
  },

  markAllAsRead: async () => {
    try {
      await apiClient.post('/notifications/read-all');
      const { notifications } = get();
      set({
        notifications: notifications.map((n) => ({ ...n, status: 'READ' })),
        unreadCount: 0,
      });
    } catch {}
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await apiClient.get('/notifications/count/unread');
      set({ unreadCount: data.unread_count || 0 });
    } catch {}
  },

  connectWebSocket: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const token = getAccessToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/notifications?token=${token}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ wsConnected: true });
      // Start heartbeat
      const heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
        else clearInterval(heartbeat);
      }, 30000);
      ws.addEventListener('close', () => clearInterval(heartbeat));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'notification' && msg.data) {
          const newNotification: NotificationItem = msg.data;
          set((state) => ({
            notifications: [newNotification, ...state.notifications].slice(0, 20),
            unreadCount: state.unreadCount + 1,
            total: state.total + 1,
          }));
        }
      } catch {}
    };

    ws.onclose = () => {
      set({ wsConnected: false });
      ws = null;
      // Reconnect after 5 seconds if token still exists
      if (getAccessToken()) {
        wsReconnectTimer = setTimeout(() => get().connectWebSocket(), 5000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  },

  disconnectWebSocket: () => {
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    set({ wsConnected: false });
  },
}));

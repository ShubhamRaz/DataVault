"use client";
/**
 * DataVault — global app store (auth session, notifications, toasts).
 */
import { create } from "zustand";
import { authApi, notificationsApi, type SessionUser, type NotificationRow } from "./api";

interface AppState {
  user: SessionUser | null;
  sessionLoading: boolean;
  notifications: NotificationRow[];
  unread: number;
  authChecked: boolean;

  loadSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: { email: string; name: string; password: string; role?: string; organizationSlug?: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  sessionLoading: true,
  notifications: [],
  unread: 0,
  authChecked: false,

  loadSession: async () => {
    set({ sessionLoading: true });
    try {
      const user = await authApi.me();
      set({ user, authChecked: true });
      if (user) await get().refreshNotifications();
    } catch {
      set({ user: null });
    } finally {
      set({ sessionLoading: false });
    }
  },

  login: async (email, password) => {
    const user = await authApi.login(email, password);
    set({ user });
    await get().refreshNotifications();
    return user;
  },

  register: async (payload) => {
    const user = await authApi.register(payload);
    set({ user });
    return user;
  },

  logout: async () => {
    await authApi.logout().catch(() => undefined);
    set({ user: null, notifications: [], unread: 0 });
  },

  refreshNotifications: async () => {
    try {
      const { notifications, unread } = await notificationsApi.list();
      set({ notifications, unread });
    } catch {
      // ignore polling errors
    }
  },

  markAllRead: async () => {
    await notificationsApi.markRead();
    set((s) => ({ unread: 0, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  },

  markRead: async (ids) => {
    await notificationsApi.markRead(ids);
    set((s) => ({
      notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
      unread: s.notifications.filter((n) => !n.read && !ids.includes(n.id)).length,
    }));
  },
}));

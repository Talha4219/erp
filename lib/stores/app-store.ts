import { create } from 'zustand'
import type { Role } from '@prisma/client'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  actionUrl?: string | null
  createdAt: string
}

type AppState = {
  // ── Session ──────────────────────────────────────────────
  userId: string | null
  userRole: Role | null
  userName: string
  userEmail: string
  allowedModules: string[] | null
  allowedSubmodules: Record<string, string[]> | null
  isHydrated: boolean

  // ── Company ──────────────────────────────────────────────
  companyName: string
  companyLogo: string | null
  companyCurrency: string
  companyCurrencySymbol: string

  // ── Notifications (cached so header doesn't refetch) ────
  notifications: Notification[]
  unreadCount: number

  // ── Actions ──────────────────────────────────────────────
  hydrateSession: (data: {
    id: string
    name: string
    email: string
    role: Role
    allowedModules: string[] | null
    allowedSubmodules: Record<string, string[]> | null
  }) => void
  setCompany: (data: { name: string; logo: string | null; currency: string; currencySymbol: string }) => void
  setNotifications: (notifications: Notification[]) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  userRole: null,
  userName: '',
  userEmail: '',
  allowedModules: null,
  allowedSubmodules: null,
  isHydrated: false,

  companyName: 'ERP',
  companyLogo: null,
  companyCurrency: 'GBP',
  companyCurrencySymbol: '£',

  notifications: [],
  unreadCount: 0,

  hydrateSession: (data) =>
    set({
      userId: data.id,
      userName: data.name,
      userEmail: data.email,
      userRole: data.role,
      allowedModules: data.allowedModules,
      allowedSubmodules: data.allowedSubmodules,
      isHydrated: true,
    }),

  setCompany: (data) =>
    set({
      companyName: data.name,
      companyLogo: data.logo,
      companyCurrency: data.currency,
      companyCurrencySymbol: data.currencySymbol,
    }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  markNotificationRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      )
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      }
    }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}))

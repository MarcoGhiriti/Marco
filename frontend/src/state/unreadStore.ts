import { create } from "zustand";
import { apiGet } from "../lib/api";
import type { UnreadSummaryOut } from "../types/community";

type UnreadState = {
  hasUnread: boolean;
  dmUserIds: string[];
  groupIds: string[];
  lastUpdatedAt: number | null;

  refresh: (accessToken: string) => Promise<void>;
  clearThread: (thread: { kind: "dm"; userId: string } | { kind: "group"; groupId: string }) => void;
};

export const useUnreadStore = create<UnreadState>((set, get) => ({
  hasUnread: false,
  dmUserIds: [],
  groupIds: [],
  lastUpdatedAt: null,

  refresh: async (accessToken: string) => {
    const data = await apiGet<UnreadSummaryOut>("/api/messages/unread-summary", {
      Authorization: `Bearer ${accessToken}`,
    });
    set({
      hasUnread: data.has_unread,
      dmUserIds: data.dm_user_ids,
      groupIds: data.group_ids,
      lastUpdatedAt: Date.now(),
    });
  },

  clearThread: (thread) => {
    if (thread.kind === "dm") {
      const next = get().dmUserIds.filter((id) => id !== thread.userId);
      set({ dmUserIds: next, hasUnread: next.length > 0 || get().groupIds.length > 0 });
      return;
    }
    const next = get().groupIds.filter((id) => id !== thread.groupId);
    set({ groupIds: next, hasUnread: next.length > 0 || get().dmUserIds.length > 0 });
  },
}));

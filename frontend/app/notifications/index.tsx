import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
};

type FriendRequestOut = {
  incoming: { id: string; username: string; avatar_base64?: string | null }[];
  outgoing: { id: string; username: string; avatar_base64?: string | null }[];
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<FriendRequestOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    try {
      const [notifs, reqs] = await Promise.all([
        apiGet<Notification[]>("/api/notifications", headers),
        apiGet<FriendRequestOut>("/api/friends/requests", headers),
      ]);
      setNotifications(notifs);
      setRequests(reqs);
    } catch (e) {
      console.error("Notifications load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const acceptFriend = async (fromId: string) => {
    if (!headers) return;
    await apiPost("/api/friends/accept", { from_user_id: fromId }, headers);
    load();
  };

  const rejectFriend = async (fromId: string) => {
    if (!headers) return;
    await apiPost("/api/friends/reject", { from_user_id: fromId }, headers);
    load();
  };

  const cancelFriend = async (toId: string) => {
    if (!headers) return;
    await apiPost("/api/friends/cancel", { from_user_id: toId }, headers);
    load();
  };

  const markRead = async (id: string) => {
    if (!headers) return;
    await apiPost(`/api/notifications/${id}/read`, {}, headers);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!headers) return;
    await apiPost("/api/notifications/read-all", {}, headers);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const NOTIF_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    friend_request: { icon: "person-add", color: Colors.accent },
    friend_accepted: { icon: "people", color: Colors.success },
    route_invite: { icon: "map", color: Colors.accent },
    event_invite: { icon: "calendar", color: "#D97706" },
    group_invite: { icon: "people-circle", color: Colors.accent },
    route_reminder: { icon: "time", color: "#D97706" },
    event_reminder: { icon: "alarm", color: "#D97706" },
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "acum";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}z`;
  };

  // Build combined list: friend requests first, then notifications
  const items: any[] = [];
  (requests?.incoming || []).forEach(r => items.push({ _type: "friend_in", ...r }));
  (requests?.outgoing || []).forEach(r => items.push({ _type: "friend_out", ...r }));
  notifications.forEach(n => items.push({ _type: "notif", ...n }));

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="notif-back-btn">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Notificări</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/community")}
          style={s.communityBtn}
          data-testid="community-btn"
        >
          <Ionicons name="people" size={20} color={Colors.bg} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <>
          {notifications.some(n => !n.read) && (
            <Pressable style={s.markAllBtn} onPress={markAllRead} data-testid="mark-all-read-btn">
              <Ionicons name="checkmark-done" size={16} color={Colors.accent} />
              <Text style={s.markAllText}>Marchează toate citite</Text>
            </Pressable>
          )}

          <FlatList
            data={items}
            keyExtractor={(item, i) => item.id || `req-${i}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={40} color={Colors.muted} />
                <Text style={s.emptyText}>Nicio notificare</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item._type === "friend_in") {
                return (
                  <View style={s.row} data-testid={`friend-request-in-${item.id}`}>
                    <Pressable onPress={() => router.push(`/profile/${item.id}`)} style={[s.iconCircle, { backgroundColor: Colors.accent + "20" }]}>
                      <Ionicons name="person-add" size={20} color={Colors.accent} />
                    </Pressable>
                    <View style={s.rowContent}>
                      <Pressable onPress={() => router.push(`/profile/${item.id}`)}>
                        <Text style={s.rowTitle}>Cerere de prietenie</Text>
                        <Text style={s.rowSub}>{item.username} vrea să fie prieten</Text>
                      </Pressable>
                      <View style={s.friendActions}>
                        <Pressable style={s.acceptBtn} onPress={() => acceptFriend(item.id)} data-testid={`accept-friend-${item.id}`}>
                          <Ionicons name="checkmark" size={16} color={Colors.bg} />
                          <Text style={s.acceptText}>Acceptă</Text>
                        </Pressable>
                        <Pressable style={s.declineBtn} onPress={() => rejectFriend(item.id)} data-testid={`reject-friend-${item.id}`}>
                          <Text style={s.declineText}>Refuză</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }

              if (item._type === "friend_out") {
                return (
                  <View style={s.row} data-testid={`friend-request-out-${item.id}`}>
                    <View style={[s.iconCircle, { backgroundColor: Colors.muted + "20" }]}>
                      <Ionicons name="hourglass" size={20} color={Colors.muted} />
                    </View>
                    <View style={s.rowContent}>
                      <Text style={s.rowTitle}>Cerere trimisă</Text>
                      <Text style={s.rowSub}>Către {item.username}</Text>
                      <Pressable style={s.cancelBtn} onPress={() => cancelFriend(item.id)} data-testid={`cancel-friend-${item.id}`}>
                        <Text style={s.cancelText}>Anulează</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              // Notification
              const cfg = NOTIF_ICONS[item.type] || { icon: "notifications", color: Colors.muted };
              return (
                <Pressable
                  style={[s.row, !item.read && s.unreadRow]}
                  onPress={() => {
                    markRead(item.id);
                    if (item.data?.route_id) router.push(`/route/${item.data.route_id}`);
                    else if (item.data?.event_id) router.push(`/event/${item.data.event_id}`);
                  }}
                  data-testid={`notification-${item.id}`}
                >
                  <View style={[s.iconCircle, { backgroundColor: cfg.color + "20" }]}>
                    <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                  </View>
                  <View style={s.rowContent}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    <Text style={s.rowSub} numberOfLines={2}>{item.message}</Text>
                  </View>
                  <Text style={s.timeText}>{timeAgo(item.created_at)}</Text>
                  {!item.read && <View style={s.unreadDot} />}
                </Pressable>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  communityBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { paddingTop: 80, alignItems: "center", gap: 12 },
  emptyText: { color: Colors.muted, fontSize: 14, fontWeight: "600" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  markAllText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  unreadRow: { backgroundColor: Colors.accent + "08" },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  rowSub: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  timeText: { color: Colors.muted, fontSize: 11, fontWeight: "500", marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 6,
  },
  friendActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  acceptText: { color: Colors.bg, fontSize: 13, fontWeight: "700" },
  declineBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  declineText: { color: Colors.muted, fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cancelText: { color: Colors.muted, fontSize: 12, fontWeight: "600" },
});

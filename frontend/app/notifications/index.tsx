import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

const TopTabs = createMaterialTopTabNavigator();

/* ───────────── Types ───────────── */
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

type InboxConversation = {
  kind: "dm" | "group";
  user_id?: string;
  username?: string;
  avatar_base64?: string | null;
  group_id?: string;
  group_name?: string;
  group_photo?: string | null;
  last_message?: string;
  last_message_at?: string;
  unread: boolean;
};

/* ───────────── UPDATES TAB ───────────── */
function UpdatesTab() {
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
      console.error("Updates load error:", e);
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
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.accent} /></View>;

  // Build combined list: friend requests first, then notifications
  const items: any[] = [];

  // Incoming friend requests
  (requests?.incoming || []).forEach(r => {
    items.push({ _type: "friend_in", ...r });
  });

  // Outgoing friend requests
  (requests?.outgoing || []).forEach(r => {
    items.push({ _type: "friend_out", ...r });
  });

  // Notifications
  notifications.forEach(n => {
    items.push({ _type: "notif", ...n });
  });

  return (
    <View style={s.tabContainer}>
      {notifications.some(n => !n.read) && (
        <Pressable style={s.markAllBtn} onPress={markAllRead} data-testid="mark-all-read-btn">
          <Ionicons name="checkmark-done" size={16} color={Colors.accent} />
          <Text style={s.markAllText}>Mark all read</Text>
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
            <Text style={s.emptyText}>No updates</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item._type === "friend_in") {
            return (
              <View style={s.row} data-testid={`friend-request-in-${item.id}`}>
                <View style={[s.iconCircle, { backgroundColor: Colors.accent + "20" }]}>
                  <Ionicons name="person-add" size={20} color={Colors.accent} />
                </View>
                <View style={s.rowContent}>
                  <Text style={s.rowTitle}>Friend request</Text>
                  <Text style={s.rowSub}>{item.username} wants to be friends</Text>
                  <View style={s.friendActions}>
                    <Pressable style={s.acceptBtn} onPress={() => acceptFriend(item.id)} data-testid={`accept-friend-${item.id}`}>
                      <Ionicons name="checkmark" size={16} color={Colors.bg} />
                      <Text style={s.acceptText}>Accept</Text>
                    </Pressable>
                    <Pressable style={s.declineBtn} onPress={() => rejectFriend(item.id)} data-testid={`reject-friend-${item.id}`}>
                      <Text style={s.declineText}>Decline</Text>
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
                  <Text style={s.rowTitle}>Pending request</Text>
                  <Text style={s.rowSub}>Sent to {item.username}</Text>
                  <Pressable style={s.cancelBtn} onPress={() => cancelFriend(item.id)} data-testid={`cancel-friend-${item.id}`}>
                    <Text style={s.cancelText}>Cancel</Text>
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
    </View>
  );
}

/* ───────────── MESSAGES TAB ───────────── */
function MessagesTab() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    try {
      const data = await apiGet<InboxConversation[]>("/api/messages/inbox", headers);
      setInbox(data);
    } catch (e) {
      console.error("Inbox load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const dms = inbox.filter(c => c.kind === "dm");
  const groups = inbox.filter(c => c.kind === "group");

  const timeAgo = (d?: string) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.accent} /></View>;

  const openDm = (userId: string) => router.push(`/community/dm/${userId}`);
  const openGroup = (groupId: string) => router.push(`/community/group/${groupId}`);
  const createGroup = () => router.push("/community" as any);

  const renderConversation = (item: InboxConversation) => {
    const isDm = item.kind === "dm";
    const name = isDm ? item.username : item.group_name;
    const avatarSrc = isDm ? item.avatar_base64 : item.group_photo;

    return (
      <Pressable
        key={isDm ? `dm-${item.user_id}` : `grp-${item.group_id}`}
        style={s.chatRow}
        onPress={() => isDm ? openDm(item.user_id!) : openGroup(item.group_id!)}
        data-testid={`chat-row-${isDm ? item.user_id : item.group_id}`}
      >
        {avatarSrc ? (
          <Image source={{ uri: `data:image/jpeg;base64,${avatarSrc}` }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Ionicons name={isDm ? "person" : "people"} size={20} color={Colors.muted} />
          </View>
        )}
        <View style={s.chatInfo}>
          <View style={s.chatTopRow}>
            <Text style={s.chatName} numberOfLines={1}>{name || "Unknown"}</Text>
            <Text style={s.chatTime}>{timeAgo(item.last_message_at)}</Text>
          </View>
          <View style={s.chatBottomRow}>
            <Text style={[s.chatPreview, item.unread && s.chatPreviewUnread]} numberOfLines={1}>
              {item.last_message || "No messages yet"}
            </Text>
            {item.unread && <View style={s.unreadBadge} />}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={[]}
      renderItem={null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View>
          {/* Direct Messages Section */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Direct Messages</Text>
            <Text style={s.sectionCount}>{dms.length}</Text>
          </View>
          {dms.length === 0 ? (
            <Text style={s.emptySection}>No conversations yet. Add friends to start chatting!</Text>
          ) : (
            dms.map(renderConversation)
          )}

          {/* Group Chats Section */}
          <View style={[s.sectionHeader, { marginTop: 12 }]}>
            <Text style={s.sectionTitle}>Group Chats</Text>
            <Pressable onPress={createGroup} style={s.newGroupBtn} data-testid="create-group-btn">
              <Ionicons name="add" size={18} color={Colors.accent} />
            </Pressable>
          </View>
          {groups.length === 0 ? (
            <Text style={s.emptySection}>No groups yet. Create or join one!</Text>
          ) : (
            groups.map(renderConversation)
          )}
        </View>
      }
    />
  );
}

/* ───────────── MAIN SCREEN ───────────── */
export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="notif-back-btn">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <TopTabs.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.bg, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
          tabBarLabelStyle: { fontWeight: "700", fontSize: 13, textTransform: "none" },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.muted,
          tabBarIndicatorStyle: { backgroundColor: Colors.accent, height: 3, borderRadius: 2 },
        }}
      >
        <TopTabs.Screen name="Updates" component={UpdatesTab} />
        <TopTabs.Screen name="Messages" component={MessagesTab} />
      </TopTabs.Navigator>
    </SafeAreaView>
  );
}

/* ───────────── STYLES ───────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  tabContainer: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { paddingTop: 80, alignItems: "center", gap: 12 },
  emptyText: { color: Colors.muted, fontSize: 14, fontWeight: "600" },

  // Mark all read
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  markAllText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },

  // Notification / friend request rows
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  unreadRow: { backgroundColor: Colors.accent + "08" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  rowSub: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  timeText: { color: Colors.muted, fontSize: 11, fontWeight: "500", marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 6 },

  // Friend request actions
  friendActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  acceptBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  acceptText: { color: Colors.bg, fontSize: 13, fontWeight: "700" },
  declineBtn: { borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 7, alignItems: "center", justifyContent: "center" },
  declineText: { color: Colors.muted, fontSize: 13, fontWeight: "600" },
  cancelBtn: { marginTop: 6, alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 5 },
  cancelText: { color: Colors.muted, fontSize: 12, fontWeight: "600" },

  // Messages tab
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionCount: { color: Colors.muted, fontSize: 12, fontWeight: "600", backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  emptySection: { color: Colors.muted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 16, fontStyle: "italic" },
  newGroupBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent + "20", alignItems: "center", justifyContent: "center" },

  // Chat rows
  chatRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.card2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  chatInfo: { flex: 1, gap: 4 },
  chatTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: { color: Colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  chatTime: { color: Colors.muted, fontSize: 11, fontWeight: "500", marginLeft: 8 },
  chatBottomRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatPreview: { color: Colors.muted, fontSize: 13, flex: 1 },
  chatPreviewUnread: { color: Colors.text, fontWeight: "600" },
  unreadBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
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

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string }> = {
  friend_request: { icon: "person-add", color: Colors.accent },
  friend_accepted: { icon: "people", color: Colors.success },
  route_invite: { icon: "map", color: Colors.accent },
  event_invite: { icon: "calendar", color: Colors.warning },
  group_invite: { icon: "people-circle", color: Colors.accent },
  route_reminder: { icon: "time", color: Colors.warning },
  event_reminder: { icon: "alarm", color: Colors.warning },
  route_updated: { icon: "refresh", color: Colors.muted },
  event_updated: { icon: "refresh", color: Colors.muted },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadNotifications = useCallback(async () => {
    if (!headers) return;
    try {
      const data = await apiGet<Notification[]>("/api/notifications", headers);
      setNotifications(data);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (id: string) => {
    if (!headers) return;
    try {
      await apiPost(`/api/notifications/${id}/read`, {}, headers);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  };

  const markAllAsRead = async () => {
    if (!headers) return;
    try {
      await apiPost("/api/notifications/read-all", {}, headers);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!headers) return;
    try {
      await apiDelete(`/api/notifications/${id}`, headers);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  };

  const handleAcceptFriend = async (notif: Notification) => {
    if (!headers) return;
    const fromUserId = notif.data.from_user_id;
    if (!fromUserId) return;
    
    try {
      await apiPost("/api/friends/accept", { from_user_id: fromUserId }, headers);
      // Mark notification as read and remove it
      await markAsRead(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      Alert.alert("Success!", "Friend request accepted 🎉");
    } catch (e) {
      Alert.alert("Error", "Failed to accept friend request");
      console.error("Failed to accept friend:", e);
    }
  };

  const handleRejectFriend = async (notif: Notification) => {
    if (!headers) return;
    const fromUserId = notif.data.from_user_id;
    if (!fromUserId) return;
    
    try {
      await apiPost("/api/friends/reject", { from_user_id: fromUserId }, headers);
      // Remove notification
      await deleteNotification(notif.id);
    } catch (e) {
      Alert.alert("Error", "Failed to reject friend request");
      console.error("Failed to reject friend:", e);
    }
  };

  const handleNotificationPress = (notif: Notification) => {
    // Mark as read
    if (!notif.read) {
      markAsRead(notif.id);
    }

    // Navigate based on type
    switch (notif.type) {
      case "friend_request":
      case "friend_accepted":
        if (notif.data.from_user_id) {
          router.push(`/profile/${notif.data.from_user_id}`);
        } else if (notif.data.user_id) {
          router.push(`/profile/${notif.data.user_id}`);
        } else {
          router.push("/(tabs)/community");
        }
        break;
      case "route_invite":
      case "route_reminder":
      case "route_updated":
        if (notif.data.route_id) {
          router.push(`/route/${notif.data.route_id}`);
        }
        break;
      case "event_invite":
      case "event_reminder":
      case "event_updated":
        if (notif.data.event_id) {
          router.push(`/event/${notif.data.event_id}`);
        }
        break;
      case "group_invite":
        if (notif.data.group_id) {
          router.push(`/community/group/${notif.data.group_id}`);
        }
        break;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconInfo = NOTIFICATION_ICONS[item.type] || {
      icon: "notifications",
      color: Colors.muted,
    };

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          Alert.alert("Delete Notification", "Remove this notification?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => deleteNotification(item.id),
            },
          ]);
        }}
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
      >
        <View
          style={[
            styles.notifIcon,
            { backgroundColor: `${iconInfo.color}20` },
          ]}
        >
          <Ionicons
            name={iconInfo.icon as any}
            size={22}
            color={iconInfo.color}
          />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off" size={48} color={Colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>
            When you receive friend requests, event invites, or reminders, they
            will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  markAllText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
  },
  list: {
    padding: 16,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  notifCardUnread: {
    backgroundColor: Colors.card2,
    borderColor: Colors.accent,
  },
  notifIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  notifMessage: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  notifTime: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { EventOut } from "../../src/types/api";

export default function EventsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<EventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!authHeader) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await apiGet<EventOut[]>("/api/events", authHeader);
      setEvents(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader]);

  const joinOrLeave = useCallback(
    async (eventId: string, isJoined: boolean) => {
      if (!authHeader) return;
      try {
        if (isJoined) {
          await apiPost(`/api/events/${eventId}/leave`, {}, authHeader);
        } else {
          await apiPost(`/api/events/${eventId}/join`, {}, authHeader);
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    },
    [authHeader, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days < 7) return `In ${days} days`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Events</Text>
            <Text style={styles.sub}>Moto events & meetups</Text>
          </View>
          <Pressable
            onPress={() => router.push("/create/event")}
            style={styles.createBtn}
          >
            <Ionicons name="add" size={20} color={Colors.bg} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              tintColor={Colors.accent}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading events…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTitle}>Couldn't load events</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.centerText}>
                Be the first to create a moto event!
              </Text>
              <Pressable
                onPress={() => router.push("/create/event")}
                style={styles.emptyBtn}
              >
                <Ionicons name="add" size={18} color={Colors.bg} />
                <Text style={styles.emptyBtnText}>Create Event</Text>
              </Pressable>
            </View>
          ) : (
            events.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/event/${e.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateBoxDay}>
                      {new Date(e.start_time).getDate()}
                    </Text>
                    <Text style={styles.dateBoxMonth}>
                      {new Date(e.start_time).toLocaleDateString("en-US", { month: "short" })}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.title} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.desc} numberOfLines={2}>
                      {e.description || "Moto event"}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={Colors.muted} />
                        <Text style={styles.metaText}>{formatDate(e.start_time)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={14} color={Colors.muted} />
                        <Text style={styles.metaText}>{e.participants_count}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.viewDetailsRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.accent} />
                    <Text style={styles.viewDetailsText}>View details & distance</Text>
                  </View>
                  <Pressable
                    onPress={(ev) => {
                      ev.stopPropagation();
                      joinOrLeave(e.id, e.is_joined);
                    }}
                    style={[styles.joinBtn, e.is_joined && styles.joinBtnJoined]}
                  >
                    <Text
                      style={[styles.joinBtnText, e.is_joined && styles.joinBtnTextJoined]}
                    >
                      {e.is_joined ? "Joined" : "Join"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 16 },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingTop: 12, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    gap: 14,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBoxDay: {
    color: Colors.accent,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  dateBoxMonth: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  cardInfo: { flex: 1, gap: 4 },
  title: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  desc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 16 },
  metaRow: { flexDirection: "row", gap: 14, marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  viewDetailsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  viewDetailsText: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  joinBtnJoined: {
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtnText: { color: Colors.bg, fontSize: 12, fontFamily: "Inter_700Bold" },
  joinBtnTextJoined: { color: Colors.text },
  center: { paddingTop: 80, alignItems: "center", gap: 12 },
  centerText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  emptyBtnText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
  errorTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  errorText: { color: Colors.muted, fontSize: 12, textAlign: "center" },
});

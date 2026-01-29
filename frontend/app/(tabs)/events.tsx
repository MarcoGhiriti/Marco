import React, { useCallback, useEffect, useState } from "react";
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
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { EventOut } from "../../src/types/api";

export default function EventsScreen() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<EventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<EventOut[]>("/api/events");
      setEvents(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Events</Text>
          <Text style={styles.sub}>Moto events</Text>
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
              <Text style={styles.errorTitle}>Couldn’t load events</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={22} color={Colors.muted} />
              <Text style={styles.centerText}>No events yet.</Text>
            </View>
          ) : (
            events.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.title} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {e.description || "Event moto"}
                </Text>
                <View style={styles.row}>
                  <Ionicons name="time-outline" size={16} color={Colors.muted} />
                  <Text style={styles.metaText}>
                    {new Date(e.start_time).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  h1: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sub: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  desc: {
    marginTop: 6,
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  center: {
    paddingTop: 80,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    color: Colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
});

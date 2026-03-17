import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type RouteRec = {
  id: string;
  title: string;
  start_city: string;
  end_city: string;
  distance_km: number;
  duration_min: number;
  difficulty: string;
  participants_count: number;
};

export default function RecommendationsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [recs, setRecs] = useState<RouteRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadRecs = async () => {
    if (!headers) return;
    try {
      const data = await apiGet<RouteRec[]>("/api/premium/recommendations", headers);
      setRecs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecs(); }, [headers]);

  const handleRefresh = async () => {
    if (!headers) return;
    setRefreshing(true);
    try {
      const data = await apiPost<RouteRec[]>("/api/premium/recommendations/refresh", {}, headers);
      setRecs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const diffColor = (d: string) => d === "easy" ? Colors.success : d === "hard" ? Colors.danger : Colors.warning;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Recommendations</Text>
        <Pressable onPress={handleRefresh} style={styles.refreshBtn} data-testid="refresh-recs-btn">
          {refreshing ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="refresh" size={20} color={Colors.accent} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : recs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="compass-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No recommendations yet</Text>
            <Text style={styles.emptyDesc}>Routes created by other users will appear here as recommendations.</Text>
          </View>
        ) : (
          recs.map((rec) => (
            <Pressable
              key={rec.id}
              style={styles.recCard}
              onPress={() => router.push(`/route/${rec.id}`)}
              data-testid={`rec-card-${rec.id}`}
            >
              <View style={styles.recHeader}>
                <Text style={styles.recTitle} numberOfLines={1}>{rec.title}</Text>
                <View style={[styles.diffBadge, { backgroundColor: diffColor(rec.difficulty) }]}>
                  <Text style={styles.diffText}>{rec.difficulty}</Text>
                </View>
              </View>
              <Text style={styles.recRoute} numberOfLines={1}>
                {rec.start_city || "Start"} {"\u2192"} {rec.end_city || "End"}
              </Text>
              <View style={styles.recMeta}>
                <View style={styles.recMetaItem}>
                  <Ionicons name="navigate" size={14} color={Colors.accent} />
                  <Text style={styles.recMetaText}>{rec.distance_km?.toFixed(1)} km</Text>
                </View>
                <View style={styles.recMetaItem}>
                  <Ionicons name="time" size={14} color={Colors.accent} />
                  <Text style={styles.recMetaText}>{rec.duration_min} min</Text>
                </View>
                <View style={styles.recMetaItem}>
                  <Ionicons name="people" size={14} color={Colors.accent} />
                  <Text style={styles.recMetaText}>{rec.participants_count}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  emptyCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 28, alignItems: "center", gap: 10,
  },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyDesc: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  recCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16, gap: 10,
  },
  recHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  diffText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  recRoute: { color: Colors.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  recMeta: { flexDirection: "row", gap: 16 },
  recMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  recMetaText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

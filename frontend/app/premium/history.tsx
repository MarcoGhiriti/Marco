import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";
import { InteractiveRouteMap } from "../../src/components/InteractiveRouteMap";

type RouteRide = {
  id: string;
  route_id: string | null;
  route: { id: string; title: string; start_city: string; end_city: string; distance_km: number; difficulty: string; polyline: number[][] } | null;
  started_at: string | null;
  ended_at: string | null;
  km_tracked: number;
};

type FreeRide = {
  id: string;
  distance_km: number;
  max_speed_kmh: number;
  duration_seconds: number;
  stops_count: number;
  stop_checkpoints: number[][];
  polyline: number[][];
  started_at: string | null;
  ended_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDur(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<"routes" | "free">("routes");
  const [routeRides, setRouteRides] = useState<RouteRide[]>([]);
  const [freeRides, setFreeRides] = useState<FreeRide[]>([]);
  const [selectedFreeRide, setSelectedFreeRide] = useState<FreeRide | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  useEffect(() => {
    if (!headers) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiGet<RouteRide[]>("/api/premium/history/routes", headers).catch(() => []),
      apiGet<FreeRide[]>("/api/premium/history/free-rides", headers).catch(() => []),
    ]).then(([rr, fr]) => {
      setRouteRides(rr);
      setFreeRides(fr);
    }).finally(() => setLoading(false));
  }, [headers]);

  const diffColor = (d: string) => d === "easy" ? Colors.success : d === "hard" ? Colors.danger : Colors.warning;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "routes" && styles.tabActive]} onPress={() => setTab("routes")}>
          <Ionicons name="map" size={16} color={tab === "routes" ? Colors.bg : Colors.muted} />
          <Text style={[styles.tabText, tab === "routes" && styles.tabTextActive]}>Routes ({routeRides.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "free" && styles.tabActive]} onPress={() => setTab("free")}>
          <Ionicons name="speedometer" size={16} color={tab === "free" ? Colors.bg : Colors.muted} />
          <Text style={[styles.tabText, tab === "free" && styles.tabTextActive]}>Free Rides ({freeRides.length})</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : tab === "routes" ? (
          routeRides.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No route rides yet</Text>
              <Text style={styles.emptyDesc}>Complete a route ride to see it here.</Text>
            </View>
          ) : (
            routeRides.map((r) => {
              const route = r.route;
              return (
                <Pressable
                  key={r.id}
                  style={styles.card}
                  onPress={() => route?.id && router.push(`/route/${route.id}`)}
                  data-testid={`history-route-${r.id}`}
                >
                  {route && route.polyline.length >= 2 ? (
                    <RouteMiniMap polyline={route.polyline} startCity={route.start_city} endCity={route.end_city} height={120} />
                  ) : null}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIconBox}>
                      <Ionicons name="map" size={20} color={Colors.accent} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{route?.title || "Route"}</Text>
                      {route ? <Text style={styles.cardRoute}>{route.start_city} {"\u2192"} {route.end_city}</Text> : null}
                    </View>
                    {route?.difficulty ? (
                      <View style={[styles.diffBadge, { backgroundColor: diffColor(route.difficulty) }]}>
                        <Text style={styles.diffText}>{route.difficulty}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaItem}>{r.km_tracked?.toFixed(1) || "0"} km</Text>
                    <Text style={styles.metaItem}>{formatDate(r.started_at)}</Text>
                  </View>
                  <Text style={styles.tapHint}>Tap for route details and map</Text>
                </Pressable>
              );
            })
          )
        ) : (
          freeRides.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="speedometer-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No free rides yet</Text>
              <Text style={styles.emptyDesc}>Start a free ride to track your journey.</Text>
            </View>
          ) : (
            freeRides.map((r) => (
              <Pressable key={r.id} style={styles.card} data-testid={`history-free-${r.id}`} onPress={() => setSelectedFreeRide(r)}>
                {r.polyline?.length >= 2 ? (
                  <RouteMiniMap polyline={r.polyline} height={120} />
                ) : null}
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconBox, { backgroundColor: `${Colors.warning}15` }]}>
                    <Ionicons name="speedometer" size={20} color={Colors.warning} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Free Ride</Text>
                    <Text style={styles.cardRoute}>{formatDate(r.started_at)}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Ionicons name="navigate" size={14} color={Colors.accent} />
                    <Text style={styles.statValue}>{r.distance_km.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="flash" size={14} color={Colors.warning} />
                    <Text style={styles.statValue}>{r.max_speed_kmh.toFixed(0)} km/h max</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="time" size={14} color={Colors.muted} />
                    <Text style={styles.statValue}>{formatDur(r.duration_seconds)}</Text>
                  </View>
                  {r.stops_count > 0 && (
                    <View style={styles.statBox}>
                      <Ionicons name="pause-circle" size={14} color={Colors.danger} />
                      <Text style={styles.statValue}>{r.stops_count} stops</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tapHint}>Tap to see route details and map</Text>
              </Pressable>
            ))
          )
        )}
      </ScrollView>

      <Modal visible={!!selectedFreeRide} transparent animationType="slide" onRequestClose={() => setSelectedFreeRide(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} data-testid="history-free-ride-detail-modal">
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Free Ride Details</Text>
                <Text style={styles.modalSubtitle}>{formatDate(selectedFreeRide?.started_at || null)}</Text>
              </View>
              <Pressable onPress={() => setSelectedFreeRide(null)} style={styles.modalCloseBtn} data-testid="history-free-ride-detail-close">
                <Ionicons name="close" size={20} color={Colors.text} />
              </Pressable>
            </View>

            {selectedFreeRide ? (
              <>
                <InteractiveRouteMap
                  polyline={selectedFreeRide.polyline}
                  stopPoints={selectedFreeRide.stop_checkpoints}
                  height={240}
                  dataTestId="history-free-ride-detail-map"
                />
                <View style={styles.detailStatsGrid}>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Distance</Text>
                    <Text style={styles.detailStatValue}>{selectedFreeRide.distance_km.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Max speed</Text>
                    <Text style={styles.detailStatValue}>{selectedFreeRide.max_speed_kmh.toFixed(0)} km/h</Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Duration</Text>
                    <Text style={styles.detailStatValue}>{formatDur(selectedFreeRide.duration_seconds)}</Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Text style={styles.detailStatLabel}>Stops</Text>
                    <Text style={styles.detailStatValue}>{selectedFreeRide.stops_count}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  tabs: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
  },
  tabActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_700Bold" },
  tabTextActive: { color: Colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  emptyCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 28, alignItems: "center", gap: 10,
  },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyDesc: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  card: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 14, gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${Colors.accent}15`, alignItems: "center", justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  cardRoute: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaItem: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.card2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  statValue: { color: Colors.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tapHint: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_700Bold" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
    padding: 12,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 16,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  modalSubtitle: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
  },
  detailStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailStatCard: {
    width: "48%",
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  detailStatLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  detailStatValue: { color: Colors.text, fontSize: 14, fontFamily: "Inter_900Black" },
});

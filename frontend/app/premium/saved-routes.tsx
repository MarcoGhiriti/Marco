import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";

type SavedRoute = {
  id: string; title: string; distance_km: number; duration_min: number; difficulty: string;
  start_address: string; end_address: string; start_lat: number; start_lng: number;
  curves_count: number; avg_speed_kmh: number; has_highways: boolean; has_urban_areas: boolean;
  waypoints_nav: { lat: number; lng: number }[]; polyline: number[][]; overview_polyline: string;
  status: string; progress_pct: number; created_at: string | null;
};

function openGoogleMapsNav(route: SavedRoute) {
  const origin = `${route.start_lat},${route.start_lng}`;
  const wps = route.waypoints_nav.map(w => `${w.lat},${w.lng}`).join("|");
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${origin}&waypoints=${encodeURIComponent(wps)}&travelmode=driving`;
  Linking.openURL(url);
}

export default function SavedRoutesScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SavedRoute | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = useMemo(() => accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, [accessToken]);

  const loadRoutes = async () => {
    if (!headers) return;
    try {
      const data = await apiGet<SavedRoute[]>("/api/premium/saved-routes", headers);
      setRoutes(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRoutes(); }, [headers]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Route", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!headers) return;
        await apiDelete(`/api/premium/saved-routes/${id}`, headers);
        setRoutes(r => r.filter(x => x.id !== id));
        if (detail?.id === id) setDetail(null);
      }},
    ]);
  };

  const handleStart = async (route: SavedRoute) => {
    if (!headers) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/saved-routes/${route.id}/start`, {}, headers);
      openGoogleMapsNav(route);
      setRoutes(r => r.map(x => x.id === route.id ? { ...x, status: "active" } : x));
      if (detail?.id === route.id) setDetail({ ...detail, status: "active" });
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleComplete = async (id: string) => {
    if (!headers) return;
    await apiPost(`/api/premium/saved-routes/${id}/complete`, {}, headers);
    setRoutes(r => r.map(x => x.id === id ? { ...x, status: "completed", progress_pct: 100 } : x));
    if (detail?.id === id) setDetail(d => d ? { ...d, status: "completed", progress_pct: 100 } : null);
  };

  const diffColor = (d: string) => d === "easy" ? Colors.success : d === "hard" ? Colors.danger : Colors.warning;

  // Full screen detail view
  if (detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => setDetail(null)} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={Colors.text} /></Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{detail.title}</Text>
          <Pressable onPress={() => handleDelete(detail.id)} style={styles.deleteBtn}><Ionicons name="trash" size={18} color={Colors.danger} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <RouteMiniMap polyline={detail.polyline} startCity={detail.start_address?.split(",")[0]} endCity={detail.end_address?.split(",")[0]} height={200} />

          <View style={styles.detailTitleRow}>
            <Text style={styles.detailTitle}>{detail.title}</Text>
            <View style={[styles.diffBadge, { backgroundColor: diffColor(detail.difficulty) }]}><Text style={styles.diffText}>{detail.difficulty}</Text></View>
          </View>

          <Text style={styles.detailRoute}>{detail.start_address?.split(",")[0] || "Start"} {"\u2192"} {detail.end_address?.split(",")[0] || "End"}</Text>
          <Text style={styles.roundTripLabel}>Round Trip</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Ionicons name="navigate" size={20} color={Colors.accent} /><Text style={styles.statVal}>{detail.distance_km}</Text><Text style={styles.statLbl}>km</Text></View>
            <View style={styles.statCard}><Ionicons name="time" size={20} color={Colors.accent} /><Text style={styles.statVal}>{detail.duration_min}</Text><Text style={styles.statLbl}>min</Text></View>
            <View style={styles.statCard}><Ionicons name="speedometer" size={20} color={Colors.accent} /><Text style={styles.statVal}>{detail.avg_speed_kmh}</Text><Text style={styles.statLbl}>avg km/h</Text></View>
            <View style={styles.statCard}><Ionicons name="git-branch" size={20} color={Colors.warning} /><Text style={styles.statVal}>{detail.curves_count}</Text><Text style={styles.statLbl}>curves</Text></View>
          </View>

          {/* Tags */}
          <View style={styles.tagsRow}>
            {detail.has_highways && <View style={styles.tag}><Ionicons name="car" size={14} color={Colors.text} /><Text style={styles.tagText}>Highway</Text></View>}
            {detail.has_urban_areas && <View style={styles.tag}><Ionicons name="business" size={14} color={Colors.text} /><Text style={styles.tagText}>Urban Areas</Text></View>}
            <View style={styles.tag}><Ionicons name="repeat" size={14} color={Colors.accent} /><Text style={styles.tagText}>Round Trip</Text></View>
          </View>

          {/* Progress (if active) */}
          {detail.status === "active" && (
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>In Progress</Text>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${detail.progress_pct}%` }]} /></View>
              <Text style={styles.progressText}>{detail.progress_pct}% complete</Text>
              <Pressable style={styles.completeBtn} onPress={() => handleComplete(detail.id)}><Ionicons name="checkmark-circle" size={18} color={Colors.bg} /><Text style={styles.completeBtnText}>Mark Complete</Text></Pressable>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.startBtn} onPress={() => handleStart(detail)} disabled={actionLoading} data-testid="start-nav-btn">
              {actionLoading ? <ActivityIndicator color={Colors.bg} /> : (
                <><Ionicons name="navigate" size={20} color={Colors.bg} /><Text style={styles.startBtnText}>Start in Google Maps</Text></>
              )}
            </Pressable>
          </View>

          {detail.status === "completed" && (
            <View style={styles.completedBadge}><Ionicons name="checkmark-circle" size={20} color={Colors.success} /><Text style={styles.completedText}>Route Completed</Text></View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.headerTitle}>Saved Routes</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : routes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No saved routes</Text>
            <Text style={styles.emptyDesc}>Generate a route and save it to see it here.</Text>
          </View>
        ) : (
          routes.map((r) => (
            <Pressable key={r.id} style={styles.routeCard} onPress={() => setDetail(r)} data-testid={`saved-route-${r.id}`}>
              <View style={styles.routeCardTop}>
                <View style={styles.routeCardIconBox}><Ionicons name="map" size={20} color={Colors.accent} /></View>
                <View style={styles.routeCardInfo}>
                  <Text style={styles.routeCardTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.routeCardSub}>{r.start_address?.split(",")[0]} {"\u2192"} {r.end_address?.split(",")[0]}</Text>
                </View>
                <View style={[styles.diffBadge, { backgroundColor: diffColor(r.difficulty) }]}><Text style={styles.diffText}>{r.difficulty}</Text></View>
              </View>
              <View style={styles.routeCardStats}>
                <Text style={styles.routeCardStat}>{r.distance_km} km</Text>
                <Text style={styles.routeCardStat}>{r.duration_min} min</Text>
                <Text style={styles.routeCardStat}>{r.curves_count} curves</Text>
              </View>
              {r.status === "active" && (
                <View style={styles.miniProgress}><View style={[styles.miniProgressFill, { width: `${r.progress_pct}%` }]} /><Text style={styles.miniProgressText}>{r.progress_pct}%</Text></View>
              )}
              {r.status === "completed" && <View style={styles.completedChip}><Ionicons name="checkmark" size={12} color={Colors.success} /><Text style={styles.completedChipText}>Completed</Text></View>}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black", flex: 1, textAlign: "center" },
  deleteBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.danger}44`, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  emptyCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 28, alignItems: "center", gap: 10 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyDesc: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  routeCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, gap: 10 },
  routeCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeCardIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${Colors.accent}15`, alignItems: "center", justifyContent: "center" },
  routeCardInfo: { flex: 1, gap: 2 },
  routeCardTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  routeCardSub: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  routeCardStats: { flexDirection: "row", gap: 12 },
  routeCardStat: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  miniProgress: { height: 6, borderRadius: 3, backgroundColor: Colors.card2, flexDirection: "row", alignItems: "center" },
  miniProgressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  miniProgressText: { color: Colors.muted, fontSize: 10, fontFamily: "Inter_700Bold", marginLeft: 6 },
  completedChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  completedChipText: { color: Colors.success, fontSize: 11, fontFamily: "Inter_700Bold" },

  // Detail
  detailContent: { padding: 16, gap: 16, paddingBottom: 40 },
  detailTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailTitle: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black", flex: 1 },
  detailRoute: { color: Colors.accent, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roundTripLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  statsGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: 70, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statVal: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black" },
  statLbl: { color: Colors.muted, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tagsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.card2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { color: Colors.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.accent}44`, borderRadius: 14, padding: 14, gap: 8 },
  progressTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: Colors.card2, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  progressText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10, marginTop: 4 },
  completeBtnText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
  actionRow: { gap: 10 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16 },
  startBtnText: { color: Colors.bg, fontSize: 16, fontFamily: "Inter_900Black" },
  completedBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: `${Colors.success}15`, borderRadius: 12, paddingVertical: 12 },
  completedText: { color: Colors.success, fontSize: 14, fontFamily: "Inter_700Bold" },
});

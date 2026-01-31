import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Polyline as SvgPolyline, Circle } from "react-native-svg";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut } from "../../src/types/api";

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [route, setRoute] = useState<RouteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  useEffect(() => {
    loadRoute();
  }, [id]);

  const loadRoute = async () => {
    if (!headers || !id) return;
    setLoading(true);
    try {
      // For now, get all routes and find the one
      const routes = await apiGet<RouteOut[]>("/api/routes", headers);
      const found = routes.find((r) => r.id === id);
      if (found) {
        setRoute(found);
      } else {
        setError("Route not found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading route");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!route) return;
    try {
      await Share.share({
        message: `🏍️ Route on Moto GO!\n\n📍 ${route.title}\n📏 ${route.distance_km.toFixed(1)} km\n⏱️ ${route.duration_min} min\n\n${route.description || "Join me on this ride!"}`,
        title: route.title,
      });
    } catch (error) {
      Alert.alert("Error", "Could not share");
    }
  };

  const handleJoin = async () => {
    if (!headers || !route) return;
    try {
      if (route.is_joined) {
        await apiPost(`/api/routes/${route.id}/leave`, {}, headers);
      } else {
        await apiPost(`/api/routes/${route.id}/join`, {}, headers);
      }
      await loadRoute();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleDelete = () => {
    if (!headers || !route) return;
    Alert.alert(
      "Delete Route",
      "Are you sure you want to delete this route? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiDelete(`/api/routes/${route.id}`, headers);
              router.back();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not delete route");
            }
          },
        },
      ]
    );
  };

  const isCreator = me?.id && route?.created_by === me.id;

  // SVG Map
  const svgData = useMemo(() => {
    if (!route || route.polyline.length < 2) return { points: "", start: null, end: null };
    
    const width = 360;
    const height = 220;
    const pad = 25;
    const w = width - pad * 2;
    const h = height - pad * 2;

    let minLat = route.polyline[0][0], maxLat = route.polyline[0][0];
    let minLng = route.polyline[0][1], maxLng = route.polyline[0][1];
    
    for (const p of route.polyline) {
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    }
    
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);
    
    const pts = route.polyline.map(p => {
      const x = pad + ((p[1] - minLng) / lngSpan) * w;
      const y = pad + (1 - (p[0] - minLat) / latSpan) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    
    const start = route.polyline[0];
    const end = route.polyline[route.polyline.length - 1];
    
    return {
      points: pts,
      start: {
        x: pad + ((start[1] - minLng) / lngSpan) * w,
        y: pad + (1 - (start[0] - minLat) / latSpan) * h,
      },
      end: {
        x: pad + ((end[1] - minLng) / lngSpan) * w,
        y: pad + (1 - (end[0] - minLat) / latSpan) * h,
      },
    };
  }, [route]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Se încarcă...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !route) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error || "Traseu negăsit"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const diffColor = route.difficulty === "easy" ? Colors.success : route.difficulty === "medium" ? "#FFC107" : Colors.danger;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {route.title}
        </Text>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <Svg width={360} height={220}>
            {svgData.points && (
              <SvgPolyline
                points={svgData.points}
                fill="none"
                stroke={Colors.accent}
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {svgData.start && (
              <>
                <Circle cx={svgData.start.x} cy={svgData.start.y} r={14} fill={Colors.success} opacity={0.3} />
                <Circle cx={svgData.start.x} cy={svgData.start.y} r={10} fill={Colors.success} />
              </>
            )}
            {svgData.end && (
              <>
                <Circle cx={svgData.end.x} cy={svgData.end.y} r={14} fill={Colors.danger} opacity={0.3} />
                <Circle cx={svgData.end.x} cy={svgData.end.y} r={10} fill={Colors.danger} />
              </>
            )}
          </Svg>
          
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.legendText}>Finish</Text>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="navigate" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.distance_km.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.duration_min}</Text>
            <Text style={styles.statLabel}>minute</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.participants_count}</Text>
            <Text style={styles.statLabel}>participanți</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: diffColor }]}>
            <Ionicons name="speedometer" size={24} color="#FFF" />
            <Text style={[styles.statValue, { color: "#FFF" }]}>
              {route.difficulty === "easy" ? "Ușor" : route.difficulty === "medium" ? "Mediu" : "Greu"}
            </Text>
            <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.8)" }]}>dificultate</Text>
          </View>
        </View>

        {/* Description */}
        {route.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descriere</Text>
            <Text style={styles.description}>{route.description}</Text>
          </View>
        )}

        {/* Cost Estimate */}
        {route.cost_estimate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Estimat</Text>
            <View style={styles.costRow}>
              <View style={styles.costItem}>
                <Ionicons name="flame-outline" size={20} color={Colors.accent} />
                <Text style={styles.costValue}>
                  {route.cost_estimate.fuel.toFixed(0)} {route.cost_estimate.currency}
                </Text>
                <Text style={styles.costLabel}>combustibil</Text>
              </View>
              {route.cost_estimate.tolls > 0 && (
                <View style={styles.costItem}>
                  <Ionicons name="card-outline" size={20} color={Colors.accent} />
                  <Text style={styles.costValue}>
                    {route.cost_estimate.tolls.toFixed(0)} {route.cost_estimate.currency}
                  </Text>
                  <Text style={styles.costLabel}>taxe drum</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Creator Badge with Delete Button */}
        {isCreator && (
          <View style={styles.creatorSection}>
            <View style={styles.creatorCard}>
              <Ionicons name="star" size={20} color={Colors.accent} />
              <Text style={styles.creatorText}>You created this route</Text>
            </View>
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={styles.deleteBtnText}>Delete Route</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleJoin}
          style={[styles.joinButton, route.is_joined && styles.joinButtonJoined]}
        >
          <Ionicons
            name={route.is_joined ? "checkmark-circle" : "add-circle-outline"}
            size={22}
            color={route.is_joined ? Colors.text : Colors.bg}
          />
          <Text style={[styles.joinButtonText, route.is_joined && styles.joinButtonTextJoined]}>
            {route.is_joined ? "You joined" : "Join Route"}
          </Text>
        </Pressable>
      </View>
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
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 16,
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
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  mapContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    alignItems: "center",
    paddingVertical: 10,
  },
  legend: {
    flexDirection: "row",
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  description: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  costRow: {
    flexDirection: "row",
    gap: 20,
  },
  costItem: {
    alignItems: "center",
    gap: 4,
  },
  costValue: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  costLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  creatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  creatorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
    paddingBottom: 30,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
  },
  joinButtonJoined: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinButtonText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  joinButtonTextJoined: {
    color: Colors.text,
  },
});

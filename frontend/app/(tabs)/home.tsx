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
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, StoryOwner, RideSessionOut } from "../../src/types/api";
import { RouteCard } from "../../src/components/RouteCard";
import { StoriesBar } from "../../src/components/StoriesBar";
import { StoryViewer } from "../../src/components/StoryViewer";

type LicenseStatus = {
  license_type: string | null;
  license_verified: boolean;
};

type UnreadCountResponse = {
  count: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [stories, setStories] = useState<StoryOwner[]>([]);
  const [activeRide, setActiveRide] = useState<RideSessionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Story viewer state
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyOwnerIndex, setStoryOwnerIndex] = useState(0);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const isLicenseVerified = licenseStatus?.license_verified === true;

  // Get user location
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        // On web, use a default location or skip
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.log("Location error:", e);
      }
    })();
  }, []);

  const loadRoutes = useCallback(async () => {
    if (!authHeader) return;
    try {
      // Build URL with location params if available
      let url = "/api/routes";
      if (userLocation) {
        url += `?lat=${userLocation.lat}&lng=${userLocation.lng}&radius_km=500`;
      }
      const data = await apiGet<RouteOut[]>(url, authHeader);
      setRoutes(data);
    } catch (e) {
      console.error("Failed to load routes:", e);
    }
  }, [authHeader, userLocation]);

  const loadStories = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<StoryOwner[]>("/api/stories", authHeader);
      setStories(data);
    } catch (e) {
      console.error("Failed to load stories:", e);
    }
  }, [authHeader]);

  const loadActiveRide = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<RideSessionOut | null>("/api/rides/active", authHeader);
      setActiveRide(data);
    } catch (e) {
      console.error("Failed to load active ride:", e);
    }
  }, [authHeader]);

  const loadLicenseStatus = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<LicenseStatus>("/api/me/license-status", authHeader);
      setLicenseStatus(data);
    } catch (e) {
      console.error("Failed to load license status:", e);
    }
  }, [authHeader]);

  const loadUnreadNotifCount = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<UnreadCountResponse>("/api/notifications/unread-count", authHeader);
      setUnreadNotifCount(data.count);
    } catch (e) {
      console.error("Failed to load notification count:", e);
    }
  }, [authHeader]);

  const load = useCallback(async () => {
    if (!authHeader) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      await Promise.all([loadRoutes(), loadStories(), loadActiveRide(), loadLicenseStatus(), loadUnreadNotifCount()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader, loadRoutes, loadStories, loadActiveRide, loadLicenseStatus, loadUnreadNotifCount]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleAddStory = () => {
    router.push("/story/create");
  };

  const handleViewStory = (ownerIndex: number) => {
    setStoryOwnerIndex(ownerIndex);
    setStoryViewerVisible(true);
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!authHeader) return;
    try {
      await apiDelete(`/api/stories/${storyId}`, authHeader);
      await loadStories();
      const currentOwner = stories[storyOwnerIndex];
      if (currentOwner && currentOwner.stories.length <= 1) {
        setStoryViewerVisible(false);
      }
    } catch (e) {
      console.error("Failed to delete story:", e);
    }
  };

  const handleStartRide = async (routeId: string) => {
    if (!authHeader) return;
    try {
      const session = await apiPost<RideSessionOut>(
        "/api/rides/start",
        { route_id: routeId },
        authHeader
      );
      setActiveRide(session);
      Alert.alert("Ride Started! 🏍️", "Your ride has begun. Ride safe!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to start ride");
    }
  };

  const handleEndRide = async () => {
    if (!authHeader || !activeRide) return;
    try {
      const result = await apiPost<RideSessionOut>(
        "/api/rides/end",
        { session_id: activeRide.id, end_location: [44.4268, 26.1025] },
        authHeader
      );
      setActiveRide(null);
      if (result.is_validated) {
        Alert.alert(
          "Ride Complete! 🎉",
          `Great ride! ${result.km_tracked.toFixed(1)} km has been added to your stats.`
        );
      } else {
        Alert.alert(
          "Ride Ended",
          "Ride completed but km were not validated (ride was too short)."
        );
      }
      await loadRoutes();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to end ride");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.h1}>Moto GO</Text>
            <Text style={styles.sub}>Recommended routes</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable 
              onPress={() => router.push("/(tabs)/shop")} 
              style={styles.shopBtn}
            >
              <Ionicons name="storefront" size={18} color={Colors.bg} />
            </Pressable>
            <View style={styles.iconBtn}>
              <Ionicons name="search-outline" size={20} color={Colors.text} />
            </View>
            <Pressable 
              onPress={() => router.push("/notifications")} 
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.text} />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Active Ride Banner */}
        {activeRide && (
          <View style={styles.activeRideBanner}>
            <View style={styles.activeRideIcon}>
              <Ionicons name="bicycle" size={20} color={Colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideTitle}>Ride in Progress</Text>
              <Text style={styles.activeRideSub}>
                Started {new Date(activeRide.start_time).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        )}

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
          {/* Stories Bar */}
          <StoriesBar
            stories={stories}
            currentUserId={me?.id}
            onAddStory={handleAddStory}
            onViewStory={handleViewStory}
          />

          {/* License Required Banner */}
          {!isLicenseVerified && (
            <Pressable 
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.licenseRequiredBanner}
            >
              <View style={styles.licenseRequiredIcon}>
                <Ionicons name="shield-checkmark" size={24} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.licenseRequiredTitle}>License Verification Required</Text>
                <Text style={styles.licenseRequiredText}>
                  Verify your motorcycle license to access routes and track kilometers.
                </Text>
              </View>
              <View style={styles.licenseRequiredArrow}>
                <Ionicons name="chevron-forward" size={20} color={Colors.warning} />
              </View>
            </Pressable>
          )}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading routes…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTitle}>Couldn't load routes</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : routes.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="trail-sign-outline" size={22} color={Colors.muted} />
              <Text style={styles.centerText}>No routes yet.</Text>
            </View>
          ) : (
            <View style={styles.routesList}>
              {routes.map((r) => (
                <RouteCard
                  key={r.id}
                  item={r}
                  currentUserId={me?.id}
                  activeRideRouteId={activeRide?.route_id}
                  onPress={() => router.push(`/route/${r.id}`)}
                  onToggleJoin={async () => {
                    if (!authHeader) return;
                    try {
                      if (r.is_joined) {
                        await apiPost(`/api/routes/${r.id}/leave`, {}, authHeader);
                      } else {
                        await apiPost(`/api/routes/${r.id}/join`, {}, authHeader);
                      }
                      await loadRoutes();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Action failed");
                    }
                  }}
                  onStartRide={() => handleStartRide(r.id)}
                  onEndRide={handleEndRide}
                />
              ))}
            </View>
          )}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>

      {/* Story Viewer Modal */}
      <StoryViewer
        visible={storyViewerVisible}
        stories={stories}
        initialOwnerIndex={storyOwnerIndex}
        currentUserId={me?.id}
        onClose={() => setStoryViewerVisible(false)}
        onDeleteStory={handleDeleteStory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerLeft: { gap: 4 },
  headerRight: { flexDirection: "row", gap: 10 },
  h1: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.2 },
  sub: { color: Colors.muted, fontSize: 13, fontWeight: "600" },
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  shopBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  activeRideBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.success,
    borderRadius: 14,
    padding: 12,
  },
  activeRideIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeRideTitle: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  activeRideSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  
  // License required banner
  licenseRequiredBanner: {
    marginHorizontal: 16,
    marginVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 16,
    padding: 14,
  },
  licenseRequiredIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,193,7,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  licenseRequiredTitle: { 
    color: Colors.warning, 
    fontSize: 14, 
    fontWeight: "700",
  },
  licenseRequiredText: { 
    color: Colors.muted, 
    fontSize: 12, 
    fontWeight: "600",
    marginTop: 2,
  },
  licenseRequiredArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,193,7,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  content: { paddingBottom: 20 },
  routesList: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  center: { paddingTop: 80, alignItems: "center", gap: 10, paddingHorizontal: 16 },
  centerText: { color: Colors.muted, fontSize: 13, fontWeight: "600", textAlign: "center" },
  errorTitle: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  errorText: { color: Colors.muted, fontSize: 12, textAlign: "center" },
});

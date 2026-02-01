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
  Modal,
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

type RideProgress = {
  ride_id: string;
  route_id: string;
  route_title: string;
  creator_id: string;
  creator_username: string;
  status: string;
  progress_percent: number;
  distance_km: number;
  elapsed_minutes: number;
  participants: string[];
  is_creator: boolean;
  current_location?: { lat: number; lng: number } | null;
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
  const [showRideModal, setShowRideModal] = useState(false);
  const [rideProgress, setRideProgress] = useState<RideProgress | null>(null);
  const [loadingRideProgress, setLoadingRideProgress] = useState(false);
  
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

  const handleOpenRideModal = async () => {
    if (!activeRide || !authHeader) return;
    setShowRideModal(true);
    setLoadingRideProgress(true);
    try {
      const progress = await apiGet<RideProgress>(
        `/api/rides/${activeRide.id}/progress`,
        authHeader
      );
      setRideProgress(progress);
    } catch (e) {
      console.error("Failed to load ride progress:", e);
    } finally {
      setLoadingRideProgress(false);
    }
  };

  const handlePauseRide = async () => {
    if (!activeRide || !authHeader) return;
    try {
      await apiPost("/api/rides/pause", { session_id: activeRide.id }, authHeader);
      Alert.alert("Paused", "Your ride has been paused. Resume when ready!");
      setShowRideModal(false);
      loadActiveRide();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to pause ride");
    }
  };

  const handleResumeRide = async () => {
    if (!activeRide || !authHeader) return;
    try {
      await apiPost("/api/rides/resume", { session_id: activeRide.id }, authHeader);
      Alert.alert("Resumed", "Your ride has been resumed!");
      setShowRideModal(false);
      loadActiveRide();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to resume ride");
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide || !authHeader) return;
    
    const confirmCancel = () => {
      if (Platform.OS === "web") {
        return window.confirm("Are you sure you want to cancel this ride? No kilometers will be recorded.");
      }
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          "Cancel Ride?",
          "Are you sure? No kilometers will be recorded.",
          [
            { text: "No", style: "cancel", onPress: () => resolve(false) },
            { text: "Yes, Cancel", style: "destructive", onPress: () => resolve(true) }
          ]
        );
      });
    };

    const confirmed = await confirmCancel();
    if (!confirmed) return;

    try {
      await apiPost("/api/rides/cancel", { session_id: activeRide.id }, authHeader);
      Alert.alert("Cancelled", "Your ride has been cancelled.");
      setShowRideModal(false);
      setActiveRide(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to cancel ride");
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
          <Pressable onPress={handleOpenRideModal} style={styles.activeRideBanner}>
            <View style={styles.activeRideIcon}>
              <Ionicons name="bicycle" size={20} color={Colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideTitle}>
                {activeRide.status === "paused" ? "Ride Paused" : "Ride in Progress"}
              </Text>
              <Text style={styles.activeRideSub}>
                Tap to view progress • Started {new Date(activeRide.start_time).toLocaleTimeString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.bg} />
          </Pressable>
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

      {/* Ride Progress Modal */}
      <Modal
        visible={showRideModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rideModal}>
            <View style={styles.rideModalHeader}>
              <Text style={styles.rideModalTitle}>Ride Progress</Text>
              <Pressable onPress={() => setShowRideModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            {loadingRideProgress ? (
              <View style={styles.rideModalLoading}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.rideModalLoadingText}>Loading progress...</Text>
              </View>
            ) : rideProgress ? (
              <View style={styles.rideModalContent}>
                {/* Route Info */}
                <Text style={styles.rideRouteTitle}>{rideProgress.route_title}</Text>
                <Text style={styles.rideCreator}>
                  Started by {rideProgress.creator_username}
                </Text>

                {/* Progress Circle */}
                <View style={styles.progressCircleContainer}>
                  <View style={styles.progressCircle}>
                    <Text style={styles.progressPercent}>
                      {Math.round(rideProgress.progress_percent)}%
                    </Text>
                    <Text style={styles.progressLabel}>Complete</Text>
                  </View>
                </View>

                {/* Stats Row */}
                <View style={styles.rideStatsRow}>
                  <View style={styles.rideStat}>
                    <Ionicons name="speedometer-outline" size={20} color={Colors.accent} />
                    <Text style={styles.rideStatValue}>{rideProgress.distance_km} km</Text>
                    <Text style={styles.rideStatLabel}>Distance</Text>
                  </View>
                  <View style={styles.rideStat}>
                    <Ionicons name="time-outline" size={20} color={Colors.accent} />
                    <Text style={styles.rideStatValue}>{Math.round(rideProgress.elapsed_minutes)} min</Text>
                    <Text style={styles.rideStatLabel}>Elapsed</Text>
                  </View>
                  <View style={styles.rideStat}>
                    <Ionicons name="people-outline" size={20} color={Colors.accent} />
                    <Text style={styles.rideStatValue}>{rideProgress.participants.length}</Text>
                    <Text style={styles.rideStatLabel}>Riders</Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View style={[
                  styles.statusBadge,
                  rideProgress.status === "paused" ? styles.statusPaused : styles.statusActive
                ]}>
                  <Ionicons 
                    name={rideProgress.status === "paused" ? "pause" : "play"} 
                    size={16} 
                    color="#FFF" 
                  />
                  <Text style={styles.statusBadgeText}>
                    {rideProgress.status === "paused" ? "PAUSED" : "ACTIVE"}
                  </Text>
                </View>

                {/* Action Buttons (only for creator) */}
                {rideProgress.is_creator && (
                  <View style={styles.rideActionBtns}>
                    {rideProgress.status === "paused" ? (
                      <Pressable onPress={handleResumeRide} style={styles.resumeBtn}>
                        <Ionicons name="play" size={20} color="#FFF" />
                        <Text style={styles.actionBtnText}>Resume Ride</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={handlePauseRide} style={styles.pauseBtn}>
                        <Ionicons name="pause" size={20} color="#FFF" />
                        <Text style={styles.actionBtnText}>Pause Ride</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={handleCancelRide} style={styles.cancelBtn}>
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                      <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Cancel</Text>
                    </Pressable>
                  </View>
                )}

                {/* Not creator info */}
                {!rideProgress.is_creator && (
                  <View style={styles.notCreatorInfo}>
                    <Ionicons name="information-circle-outline" size={18} color={Colors.muted} />
                    <Text style={styles.notCreatorText}>
                      Only the ride creator can pause or stop the ride.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.rideModalLoading}>
                <Text style={styles.rideModalLoadingText}>Could not load progress</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
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
  
  // Ride Progress Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  rideModal: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  rideModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rideModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  rideModalLoading: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  rideModalLoadingText: {
    color: Colors.muted,
    fontSize: 14,
  },
  rideModalContent: {
    padding: 20,
    alignItems: "center",
  },
  rideRouteTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  rideCreator: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
  },
  progressCircleContainer: {
    marginVertical: 24,
  },
  progressCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.card,
    borderWidth: 8,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  progressPercent: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.accent,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "600",
  },
  rideStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  rideStat: {
    alignItems: "center",
    gap: 4,
  },
  rideStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  rideStatLabel: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusActive: {
    backgroundColor: Colors.success,
  },
  statusPaused: {
    backgroundColor: Colors.warning,
  },
  statusBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  rideActionBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  pauseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.success,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  notCreatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  notCreatorText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
});

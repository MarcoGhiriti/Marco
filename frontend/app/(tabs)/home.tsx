import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { useUnreadStore } from "../../src/state/unreadStore";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";
import type { RouteOut, StoryOwner, RideSessionOut, ActiveRideForHomeOut, EventOut } from "../../src/types/api";
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
  const { t } = useTranslation();
  const { hasUnread, refresh: refreshUnread } = useUnreadStore();
  const insets = useSafeAreaInsets();
  
  // Cross-platform alert helper (Alert.alert doesn't work on web)
  const showAlert = (title: string, message: string, buttons?: Array<{ text: string; style?: string; onPress?: () => void }>) => {
    if (Platform.OS === "web") {
      if (buttons && buttons.length > 1) {
        // For confirmation dialogs with multiple buttons
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed && buttons[1]?.onPress) {
          buttons[1].onPress();
        } else if (!confirmed && buttons[0]?.onPress) {
          buttons[0].onPress();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons as any);
    }
  };
  
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [events, setEvents] = useState<EventOut[]>([]);
  const [stories, setStories] = useState<StoryOwner[]>([]);
  const [activeRide, setActiveRide] = useState<RideSessionOut | null>(null);
  const [activeRideForHome, setActiveRideForHome] = useState<ActiveRideForHomeOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showRideModal, setShowRideModal] = useState(false);

  // Feed filter toggles
  const [feedShowRoutes, setFeedShowRoutes] = useState(true);
  const [feedShowEvents, setFeedShowEvents] = useState(false);
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
      let url = "/api/routes";
      if (userLocation) {
        // Filter routes within 100km radius for discovery
        url += `?lat=${userLocation.lat}&lng=${userLocation.lng}&radius_km=100`;
      }
      const data = await apiGet<RouteOut[]>(url, authHeader);
      setRoutes(data);
    } catch (e) {
      console.error("Failed to load routes:", e);
    }
  }, [authHeader, userLocation]);

  const loadEvents = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<EventOut[]>("/api/events", authHeader);
      setEvents(data);
    } catch (e) {
      console.error("Failed to load events:", e);
    }
  }, [authHeader]);

  const loadStories = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<StoryOwner[]>("/api/stories", authHeader);

      // Ensure "my story" is always first (Instagram-like ordering)
      let ordered = data;
      if (me?.id) {
        const ownIndex = data.findIndex((s) => s.user_id === me.id);
        if (ownIndex >= 0) {
          ordered = [data[ownIndex], ...data.filter((_, i) => i !== ownIndex)];
        }
      }

      setStories(ordered);
    } catch (e) {
      console.error("Failed to load stories:", e);
    }
  }, [authHeader, me?.id]);

  const loadActiveRide = useCallback(async () => {
    if (!authHeader) return;
    try {
      // Creator's own ride session (used for controls)
      const data = await apiGet<RideSessionOut | null>("/api/rides/active", authHeader);
      setActiveRide(data);
    } catch (e) {
      console.error("Failed to load active ride:", e);
    }
  }, [authHeader]);

  const loadActiveRideForHome = useCallback(async () => {
    if (!authHeader) return;
    try {
      // For participants OR creators (view-only banner status)
      const data = await apiGet<ActiveRideForHomeOut | null>("/api/rides/active-for-home", authHeader);
      setActiveRideForHome(data);
    } catch (e) {
      console.error("Failed to load active ride for home:", e);
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
      await Promise.all([loadRoutes(), loadEvents(), loadStories(), loadActiveRide(), loadActiveRideForHome(), loadLicenseStatus(), loadUnreadNotifCount()]);
      // Refresh unread messages count (pass accessToken, not the header object)
      if (accessToken) {
        refreshUnread(accessToken);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader, loadRoutes, loadEvents, loadStories, loadActiveRide, loadActiveRideForHome, loadLicenseStatus, loadUnreadNotifCount]);

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
      // Reload progress to show updated status (PAUSED) - keep modal open!
      const progress = await apiGet<RideProgress>(
        `/api/rides/${activeRide.id}/progress`,
        authHeader
      );
      setRideProgress(progress);
      loadActiveRide();
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to pause ride");
    }
  };

  const handleResumeRide = async () => {
    if (!activeRide || !authHeader) return;
    try {
      await apiPost("/api/rides/resume", { session_id: activeRide.id }, authHeader);
      // Reload progress to show updated status (ACTIVE) - keep modal open!
      const progress = await apiGet<RideProgress>(
        `/api/rides/${activeRide.id}/progress`,
        authHeader
      );
      setRideProgress(progress);
      loadActiveRide();
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to resume ride");
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
      showAlert("Cancelled", "Your ride has been cancelled.");
      setShowRideModal(false);
      setActiveRide(null);
      load();
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to cancel ride");
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
      showAlert("Ride Started!", "Your ride has begun. Ride safe!");
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to start ride");
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
        showAlert(
          "Ride Complete!",
          `Great ride! ${result.km_tracked.toFixed(1)} km has been added to your stats.`
        );
      } else {
        showAlert(
          "Ride Ended",
          "Ride completed but km were not validated (ride was too short)."
        );
      }
      await loadRoutes();
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to end ride");
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.h1}>Moto GO</Text>
            <Text style={styles.sub}>Recommended routes</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/search/routes")} style={styles.iconBtn}>
              <Ionicons name="search-outline" size={20} color={Colors.text} />
            </Pressable>
            {/* Chat/Messages Button with Unread Badge */}
            <Pressable 
              onPress={() => router.push("/(tabs)/community")} 
              style={styles.iconBtn}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={Colors.text} />
              {hasUnread && (
                <View style={styles.unreadDot} />
              )}
            </Pressable>
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
            {/* Profile Avatar */}
            <Pressable 
              onPress={() => router.push("/(tabs)/profile")} 
              style={styles.profileAvatarBtn}
            >
              {me?.profile_photo_base64 ? (
                <Image 
                  source={{ uri: me.profile_photo_base64 }} 
                  style={styles.profileAvatarImg} 
                />
              ) : (
                <Ionicons name="person" size={20} color={Colors.bg} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Active Ride Banner (creator or participant view) */}
        {activeRideForHome && (
          <View
            style={[
              styles.activeRideBanner,
              activeRideForHome.status === "paused" && styles.pausedRideBanner,
            ]}
          >
            <Pressable 
              style={styles.activeRideContent}
              onPress={() => {
                if (activeRide) {
                  handleOpenRideModal();
                  return;
                }
                router.push(`/route/${activeRideForHome.route_id}`);
              }}
            >
              <View style={styles.activeRideIcon}>
                <Ionicons
                  name={activeRideForHome.status === "paused" ? "pause" : "speedometer"}
                  size={20}
                  color={Colors.bg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeRideTitle}>
                  {activeRideForHome.status === "paused" ? "Ride Paused" : "Ride in Progress"}
                </Text>
                <Text style={styles.activeRideSub}>
                  {activeRide
                    ? `Tap to ${activeRideForHome.status === "paused" ? "resume" : "view progress"}`
                    : "Tap to view route"}
                </Text>
              </View>
            </Pressable>
            <View style={styles.activeRideActions}>
              <Pressable 
                style={styles.activeRideActionBtn}
                onPress={() => router.push(`/route/${activeRideForHome.route_id}`)}
                data-testid="ride-directions-btn"
              >
                <Ionicons name="navigate" size={16} color={Colors.bg} />
              </Pressable>
              {activeRide && (
                <Pressable 
                  style={[styles.activeRideActionBtn, styles.activeRideEndBtn]}
                  onPress={handleEndRide}
                  data-testid="ride-end-btn"
                >
                  <Ionicons name="stop" size={16} color={Colors.bg} />
                </Pressable>
              )}
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
          {/* Stories Bar + Feed Toggle Buttons */}
          <View style={styles.storiesRow}>
            <View style={{ flex: 1 }}>
              <StoriesBar
                stories={stories}
                currentUserId={me?.id}
                onAddStory={handleAddStory}
                onViewStory={handleViewStory}
              />
            </View>
            <View style={styles.feedToggles}>
              <Pressable
                style={[styles.feedToggle, feedShowRoutes && styles.feedToggleActive]}
                onPress={() => setFeedShowRoutes(p => !p)}
                data-testid="feed-toggle-routes"
              >
                <Ionicons name="trail-sign" size={16} color={feedShowRoutes ? Colors.bg : Colors.text} />
              </Pressable>
              <Pressable
                style={[styles.feedToggle, feedShowEvents && styles.feedToggleActiveEvent]}
                onPress={() => setFeedShowEvents(p => !p)}
                data-testid="feed-toggle-events"
              >
                <Ionicons name="calendar" size={16} color={feedShowEvents ? Colors.bg : Colors.text} />
              </Pressable>
            </View>
          </View>

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
              <Text style={styles.centerText}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTitle}>Couldn't load feed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : !feedShowRoutes && !feedShowEvents ? (
            <View style={styles.center}>
              <Ionicons name="toggle-outline" size={22} color={Colors.muted} />
              <Text style={styles.centerText}>Enable routes or events filter</Text>
            </View>
          ) : (
            <View style={styles.routesList}>
              {/* Routes */}
              {feedShowRoutes && routes.map((r) => (
                <RouteCard
                  key={r.id}
                  item={r}
                  currentUserId={me?.id}
                  activeRideRouteId={activeRide?.route_id}
                  showRideControls={false}
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
                      const errorMsg = e instanceof Error ? e.message : "Action failed";
                      // Parse CC error messages for better UX
                      if (errorMsg.includes("Minimum") && errorMsg.includes("cc")) {
                        const minCc = errorMsg.match(/\d+/)?.[0] || "?";
                        showAlert(
                          t("routes.ccRequired"),
                          t("routes.ccRequiredMessage", { minCc, userCc: me?.bike?.cc || "?" }),
                          [{ text: t("common.ok") }]
                        );
                      } else if (errorMsg.includes("Set your bike CC")) {
                        showAlert(
                          t("routes.bikeNotConfigured"),
                          t("routes.bikeNotConfiguredMessage"),
                          [
                            { text: t("common.cancel"), style: "cancel" },
                            { text: t("profile.editProfile"), onPress: () => router.push("/profile/edit") }
                          ]
                        );
                      } else {
                        showAlert(t("common.error"), errorMsg);
                      }
                    }
                  }}
                  onStartRide={() => handleStartRide(r.id)}
                  onEndRide={handleEndRide}
                />
              ))}

              {/* Events */}
              {feedShowEvents && events.map((ev) => (
                <Pressable
                  key={`evt-${ev.id}`}
                  style={styles.eventFeedCard}
                  onPress={() => router.push(`/event/${ev.id}`)}
                  data-testid={`home-event-card-${ev.id}`}
                >
                  <RouteMiniMap
                    lat={ev.start_point?.[0]}
                    lng={ev.start_point?.[1]}
                    locationName={ev.location_name}
                    height={120}
                  />
                  <View style={styles.eventFeedInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventFeedTitle} numberOfLines={1}>{ev.title}</Text>
                      <View style={styles.eventFeedMeta}>
                        <Ionicons name="time-outline" size={13} color={Colors.muted} />
                        <Text style={styles.eventFeedMetaText}>
                          {new Date(ev.start_time).toLocaleDateString("ro", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      <View style={styles.eventFeedMeta}>
                        <Ionicons name="people-outline" size={13} color={Colors.accent} />
                        <Text style={[styles.eventFeedMetaText, { color: Colors.accent }]}>{ev.participants_count ?? 0} going</Text>
                      </View>
                    </View>
                    <View style={styles.eventBadge}>
                      <Ionicons name="calendar" size={14} color={Colors.bg} />
                      <Text style={styles.eventBadgeText}>Event</Text>
                    </View>
                  </View>
                </Pressable>
              ))}

              {feedShowRoutes && routes.length === 0 && feedShowEvents && events.length === 0 && (
                <View style={styles.center}>
                  <Ionicons name="trail-sign-outline" size={22} color={Colors.muted} />
                  <Text style={styles.centerText}>No content yet.</Text>
                </View>
              )}
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
    </View>
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
  headerRight: { flexDirection: "row", gap: 10, alignItems: "center" },
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
  profileAvatarBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  profileAvatarImg: {
    width: "100%",
    height: "100%",
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
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.bg,
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
  pausedRideBanner: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
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
  activeRideContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeRideActions: {
    flexDirection: "row",
    gap: 8,
  },
  activeRideActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeRideEndBtn: {
    backgroundColor: "#FF3B30",
  },
  
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

  // Feed toggle buttons
  storiesRow: { flexDirection: "row" as const, alignItems: "flex-start" },
  feedToggles: {
    paddingRight: 12,
    paddingTop: 10,
    gap: 6,
    alignItems: "center" as const,
  },
  feedToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  feedToggleActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  feedToggleActiveEvent: {
    backgroundColor: "#D97706",
    borderColor: "#D97706",
  },

  // Event card in home feed
  eventFeedCard: {
    borderRadius: 16,
    overflow: "hidden" as const,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventFeedInfo: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  eventFeedTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  eventFeedMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginTop: 2,
  },
  eventFeedMetaText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "500" as const,
  },
  eventBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "#D97706",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventBadgeText: {
    color: Colors.bg,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  
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

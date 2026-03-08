import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeTabBarHeight } from "../../src/hooks/useSafeTabBarHeight";
import * as Location from "expo-location";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { MeetingPointOut, RouteOut, ActiveRideForHomeOut } from "../../src/types/api";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";
import { formatDuration, openDirectionsInGoogleMaps, openDirectionsToPoint } from "../../src/lib/utils";

export default function RoutesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { accessToken, me } = useAuthStore();
  const tabBarHeight = useSafeTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();
  
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"explore" | "my">("explore");
  const [activeRide, setActiveRide] = useState<ActiveRideForHomeOut | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const horizontalCardWidth = Math.min(340, Math.max(272, screenWidth * 0.82));
  
  // Minimum participants required to start a route
  const MIN_PARTICIPANTS_TO_START = 3;

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Cross-platform alert helper
  const showAlert = (title: string, message: string, buttons?: Array<{ text: string; style?: string; onPress?: () => void }>) => {
    if (Platform.OS === "web") {
      if (buttons && buttons.length > 1) {
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

  // Handle Start Ride with validations
  const handleStartRide = async (route: RouteOut) => {
    const meetingPoint = getMeetingPoint(route.meeting_point);
    const startRadiusKm = route.start_radius_km ?? 5;

    // Validation 1: Check minimum participants
    if (route.participants_count < MIN_PARTICIPANTS_TO_START) {
      showAlert(
        t("routes.cannotStart"),
        "Dacă vrei ture singur sau de 2 persoane, cumpără abonamentul pentru rute private"
      );
      return;
    }

    // Validation 2: Check user is within the allowed meeting point radius
    if (!meetingPoint) {
      showAlert(t("common.error"), "This route is missing a meeting point.");
      return;
    }

    if (!userLocation) {
      showAlert(
        t("common.error"),
        `Location access is required to start within ${startRadiusKm.toFixed(1)} km of the meeting point.`
      );
      return;
    }

    const distanceToStart = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      meetingPoint.lat,
      meetingPoint.lng
    );

    if (distanceToStart > startRadiusKm) {
      showAlert(
        t("routes.cannotStart"),
        `Too far from meeting point (${distanceToStart.toFixed(1)} km). Move within ${startRadiusKm.toFixed(1)} km to start.`
      );
      return;
    }

    // All validations passed - start the ride
    setActionLoading(route.id);
    try {
      await apiPost(
        "/api/rides/start",
        {
          route_id: route.id,
          user_lat: userLocation.lat,
          user_lng: userLocation.lng,
        },
        authHeader
      );
      await loadRoutes(); // Refresh to get updated active ride status
      showAlert(t("routes.rideStarted"), t("routes.rideStartedMessage"));
    } catch (error: any) {
      console.error("Start ride error:", error);
      showAlert(t("common.error"), error?.message || t("common.genericError"));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Pause Ride
  const handlePauseRide = async () => {
    if (!activeRide) return;
    setActionLoading("pause");
    try {
      await apiPost("/api/rides/pause", { session_id: activeRide.ride_id }, authHeader);
      await loadRoutes();
    } catch (error: any) {
      console.error("Pause ride error:", error);
      showAlert(t("common.error"), error?.message || t("common.genericError"));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Resume Ride
  const handleResumeRide = async () => {
    if (!activeRide) return;
    setActionLoading("resume");
    try {
      await apiPost("/api/rides/resume", { session_id: activeRide.ride_id }, authHeader);
      await loadRoutes();
    } catch (error: any) {
      console.error("Resume ride error:", error);
      showAlert(t("common.error"), error?.message || t("common.genericError"));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle End Ride
  const handleEndRide = async () => {
    if (!activeRide) return;
    
    showAlert(
      t("routes.endRideConfirm"),
      t("routes.endRideConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.end"),
          style: "destructive",
          onPress: async () => {
            setActionLoading("end");
            try {
              // Get current location for end_location
              let endLocation = [0, 0];
              if (userLocation) {
                endLocation = [userLocation.lat, userLocation.lng];
              }
              await apiPost("/api/rides/end", { 
                session_id: activeRide.ride_id, 
                end_location: endLocation 
              }, authHeader);
              await loadRoutes();
              showAlert(t("routes.rideEnded"), t("routes.rideEndedMessage"));
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              console.log("End ride error message:", errMsg);
              showAlert(t("common.error"), errMsg);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // Handle Directions
  const handleDirections = (route: RouteOut) => {
    openDirectionsInGoogleMaps(route.polyline);
  };

  // Get user location
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let browserWatchId: number | null = null;
    let cancelled = false;

    const updateLocation = (lat: number, lng: number) => {
      if (!cancelled) {
        setUserLocation({ lat, lng });
      }
    };

    (async () => {
      try {
        if (Platform.OS === "web") {
          if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => updateLocation(position.coords.latitude, position.coords.longitude),
              (error) => console.log("Browser location error:", error),
              { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
            );
            browserWatchId = navigator.geolocation.watchPosition(
              (position) => updateLocation(position.coords.latitude, position.coords.longitude),
              (error) => console.log("Browser location watch error:", error),
              { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
            );
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        updateLocation(loc.coords.latitude, loc.coords.longitude);
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100,
            timeInterval: 15000,
          },
          (location) => updateLocation(location.coords.latitude, location.coords.longitude)
        );
      } catch (e) {
        console.log("Location error:", e);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (browserWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(browserWatchId);
      }
    };
  }, []);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRouteReferencePoint = (route: RouteOut): { lat: number; lng: number } | null => {
    if (route.meeting_point && typeof route.meeting_point.lat === "number" && typeof route.meeting_point.lng === "number") {
      return { lat: route.meeting_point.lat, lng: route.meeting_point.lng };
    }
    if (route.start_point && route.start_point.length >= 2) {
      return { lat: route.start_point[0], lng: route.start_point[1] };
    }
    if (route.polyline && route.polyline.length > 0) {
      return { lat: route.polyline[0][0], lng: route.polyline[0][1] };
    }
    return null;
  };

  const getMeetingPoint = (meetingPoint?: MeetingPointOut | null): MeetingPointOut | null => {
    if (
      meetingPoint &&
      typeof meetingPoint.lat === "number" &&
      typeof meetingPoint.lng === "number"
    ) {
      return meetingPoint;
    }
    return null;
  };

  const loadRoutes = useCallback(async () => {
    if (!authHeader) {
      setLoading(false);
      return;
    }
    try {
      const [allRoutes, userRoutes, activeRideData] = await Promise.all([
        apiGet<RouteOut[]>("/api/routes", authHeader),
        apiGet<RouteOut[]>("/api/routes/my", authHeader),
        apiGet<ActiveRideForHomeOut | null>("/api/rides/active-for-home", authHeader).catch(() => null),
      ]);
      setRoutes(allRoutes);
      setMyRoutes(userRoutes);
      setActiveRide(activeRideData);
    } catch (e) {
      console.error("Failed to load routes:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRoutes();
  }, [loadRoutes]);

  const filteredRoutes = useMemo(() => {
    const sourceRoutes = activeTab === "explore" ? routes : myRoutes;
    if (!searchQuery.trim()) return sourceRoutes;
    
    const query = searchQuery.toLowerCase();
    return sourceRoutes.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.start_city?.toLowerCase().includes(query) ||
        r.end_city?.toLowerCase().includes(query)
    );
  }, [routes, myRoutes, activeTab, searchQuery]);

  const nearbyUserCreatedRoutes = useMemo(() => {
    if (!userLocation) return [];

    return routes
      .filter((route) => Boolean(route.created_by))
      .map((route) => {
        const referencePoint = getRouteReferencePoint(route);
        const distanceFromUser = referencePoint
          ? calculateDistance(userLocation.lat, userLocation.lng, referencePoint.lat, referencePoint.lng)
          : Number.POSITIVE_INFINITY;

        return {
          route,
          distanceFromUser,
        };
      })
      .filter((entry) => Number.isFinite(entry.distanceFromUser) && entry.distanceFromUser <= 100)
      .sort((a, b) => a.distanceFromUser - b.distanceFromUser)
      .slice(0, 10)
      .map((entry) => entry.route);
  }, [routes, userLocation]);

  const renderRouteCard = (
    item: RouteOut,
    options?: { layout?: "vertical" | "horizontal"; testIdPrefix?: string }
  ) => {
    const layout = options?.layout ?? "vertical";
    const testIdPrefix = options?.testIdPrefix ?? "route-card-list";
    const isOwner = item.created_by === me?.id;
    const isInMyRoutesTab = activeTab === "my";
    const hasActiveRideOnThisRoute = activeRide?.route_id === item.id;
    const isRidePaused = hasActiveRideOnThisRoute && activeRide?.status === "paused";
    const participantsCount = item.participants_count || 0;
    const hasEnoughParticipants = participantsCount >= MIN_PARTICIPANTS_TO_START;
    const meetingPoint = getMeetingPoint(item.meeting_point);
    const startRadiusKm = item.start_radius_km ?? 5;
    
    // Calculate distance to meeting point
    let distanceToMeetingPoint: number | null = null;
    if (userLocation && meetingPoint) {
      distanceToMeetingPoint = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        meetingPoint.lat,
        meetingPoint.lng
      );
    }
    const isWithinStartRange =
      distanceToMeetingPoint !== null && distanceToMeetingPoint <= startRadiusKm;
    const isStartDisabled =
      actionLoading === item.id ||
      !!activeRide ||
      !meetingPoint ||
      !hasEnoughParticipants ||
      distanceToMeetingPoint === null ||
      !isWithinStartRange;
    const meetingPointLabel = meetingPoint?.name?.trim() || "Meeting point";
    const meetingPointAddress = meetingPoint?.address?.trim();
    
    return (
      <Pressable
        style={[
          styles.routeCard,
          layout === "horizontal" && {
            width: horizontalCardWidth,
            marginRight: 14,
          },
        ]}
        onPress={() => router.push(`/route/${item.id}`)}
        data-testid={`${testIdPrefix}-${item.id}`}
      >
        {/* Route Mini Map */}
        <View style={styles.routeMapContainer}>
          <RouteMiniMap polyline={item.polyline} />
          
          {/* Difficulty Badge */}
          <View style={[
            styles.difficultyBadge,
            item.difficulty === "easy" && styles.difficultyEasy,
            item.difficulty === "medium" && styles.difficultyMedium,
            item.difficulty === "hard" && styles.difficultyHard,
          ]}>
            <Text style={styles.difficultyText}>
              {item.difficulty === "easy" ? t("routes.easy") : item.difficulty === "medium" ? t("routes.medium") : t("routes.hard")}
            </Text>
          </View>
          
          {/* Active Ride Badge */}
          {hasActiveRideOnThisRoute && (
            <View style={[styles.activeRideBadge, isRidePaused && styles.pausedRideBadge]}>
              <Ionicons name={isRidePaused ? "pause" : "play"} size={12} color="#FFF" />
              <Text style={styles.activeRideBadgeText}>
                {isRidePaused ? t("common.paused") : t("common.active")}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.routeInfo}>
          <Text style={styles.routeTitle} numberOfLines={1}>{item.title}</Text>
          
          <View style={styles.routeMetaRow}>
            <View style={styles.routeMetaItem}>
              <Ionicons name="resize-outline" size={14} color={Colors.muted} />
              <Text style={styles.routeMetaText}>
                {item.distance_km?.toFixed(1) || "?"} km
              </Text>
            </View>
            <View style={styles.routeMetaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.muted} />
              <Text style={styles.routeMetaText}>
                {formatDuration(item.duration_min)}
              </Text>
            </View>
          </View>
          
          <View style={styles.routeLocationRow}>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {item.start_city || t("routes.startCity")} → {item.end_city || t("routes.endCity")}
            </Text>
          </View>
          
          <View style={styles.routeFooter}>
            <View style={styles.routeStats}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={14} color={Colors.accent} />
                <Text style={styles.statText}>{participantsCount}</Text>
              </View>
            </View>
            
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>{t("routes.yourRoute")}</Text>
              </View>
            )}
          </View>
          
          {/* Control Panel - Only in "My Routes" tab for route owners */}
          {isInMyRoutesTab && isOwner && (
            <View style={styles.controlPanel} data-testid={`control-panel-${item.id}`}>
              <Text style={styles.controlPanelTitle}>{t("routes.controlPanel")}</Text>

              <View style={styles.meetingPointCard} data-testid={`meeting-point-card-${item.id}`}>
                <View style={styles.meetingPointHeader}>
                  <View style={styles.meetingPointTitleRow}>
                    <Ionicons name="flag" size={14} color={Colors.accent} />
                    <Text style={styles.meetingPointTitle} data-testid={`meeting-point-name-${item.id}`}>
                      {meetingPointLabel}
                    </Text>
                  </View>
                  <View style={styles.meetingRadiusBadge}>
                    <Text style={styles.meetingRadiusText}>{startRadiusKm.toFixed(1)} km radius</Text>
                  </View>
                </View>

                {meetingPointAddress ? (
                  <Text style={styles.meetingPointAddress} data-testid={`meeting-point-address-${item.id}`}>
                    {meetingPointAddress}
                  </Text>
                ) : null}

                {meetingPoint ? (
                  <View style={styles.meetingPointMetaRow}>
                    <View style={styles.meetingDistancePill}>
                      <Ionicons name="navigate" size={12} color={Colors.accent} />
                      <Text style={styles.meetingDistanceText} data-testid={`meeting-point-distance-${item.id}`}>
                        {distanceToMeetingPoint !== null
                          ? `Distance to meeting point: ${distanceToMeetingPoint.toFixed(1)} km`
                          : "Distance to meeting point: enable location"}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.navigateMeetingPointBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openDirectionsToPoint(meetingPoint, meetingPointLabel || item.title);
                      }}
                      data-testid={`navigate-meeting-point-btn-${item.id}`}
                    >
                      <Ionicons name="navigate" size={14} color={Colors.bg} />
                      <Text style={styles.navigateMeetingPointText}>Navigate to meeting point</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.controlWarning} data-testid={`meeting-point-missing-${item.id}`}>
                    This route is missing a meeting point.
                  </Text>
                )}
              </View>
              
              <View style={styles.controlButtonsRow}>
                {/* Start Button - visible when no active ride */}
                {!hasActiveRideOnThisRoute && (
                  <Pressable
                    style={[
                      styles.controlBtn,
                      styles.startBtn,
                      (!hasEnoughParticipants || !isWithinStartRange) && styles.controlBtnDisabled,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleStartRide(item);
                    }}
                    disabled={isStartDisabled}
                    data-testid={`start-btn-${item.id}`}
                  >
                    {actionLoading === item.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="play" size={16} color="#FFF" />
                        <Text style={styles.controlBtnText}>{t("common.start")}</Text>
                      </>
                    )}
                  </Pressable>
                )}
                
                {/* Pause/Resume Button - visible only when this route has active ride */}
                {hasActiveRideOnThisRoute && (
                  <Pressable
                    style={[styles.controlBtn, isRidePaused ? styles.resumeBtn : styles.pauseBtn]}
                    onPress={(e) => {
                      e.stopPropagation();
                      isRidePaused ? handleResumeRide() : handlePauseRide();
                    }}
                    disabled={actionLoading === "pause" || actionLoading === "resume"}
                    data-testid={`pause-resume-btn-${item.id}`}
                  >
                    {(actionLoading === "pause" || actionLoading === "resume") ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name={isRidePaused ? "play" : "pause"} size={16} color="#FFF" />
                        <Text style={styles.controlBtnText}>
                          {isRidePaused ? t("common.resume") : t("common.pause")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
                
                {/* End Button - visible only when this route has active ride */}
                {hasActiveRideOnThisRoute && (
                  <Pressable
                    style={[styles.controlBtn, styles.endBtn]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEndRide();
                    }}
                    disabled={actionLoading === "end"}
                    data-testid={`end-btn-${item.id}`}
                  >
                    {actionLoading === "end" ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="flag" size={16} color="#FFF" />
                        <Text style={styles.controlBtnText}>{t("common.end")}</Text>
                      </>
                    )}
                  </Pressable>
                )}
                
                {/* Directions Button - visible only when this route has active ride */}
                {hasActiveRideOnThisRoute && (
                  <Pressable
                    style={[styles.controlBtn, styles.directionsBtn]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDirections(item);
                    }}
                    data-testid={`directions-btn-${item.id}`}
                  >
                    <Ionicons name="navigate" size={16} color="#FFF" />
                    <Text style={styles.controlBtnText}>{t("routes.directions")}</Text>
                  </Pressable>
                )}
              </View>
              
              {/* Warning messages when Start is disabled */}
              {!hasActiveRideOnThisRoute && !hasEnoughParticipants && (
                <Text style={styles.controlWarning} data-testid={`control-warning-participants-${item.id}`}>
                  {t("routes.minParticipantsRequired", { count: MIN_PARTICIPANTS_TO_START })} ({participantsCount}/{MIN_PARTICIPANTS_TO_START})
                </Text>
              )}
              {!hasActiveRideOnThisRoute && hasEnoughParticipants && !meetingPoint && (
                <Text style={styles.controlWarning} data-testid={`control-warning-meeting-point-${item.id}`}>
                  Add a meeting point to start this ride.
                </Text>
              )}
              {!hasActiveRideOnThisRoute && hasEnoughParticipants && meetingPoint && !isWithinStartRange && distanceToMeetingPoint !== null && (
                <Text style={styles.controlWarning} data-testid={`control-warning-distance-${item.id}`}>
                  Move within {startRadiusKm.toFixed(1)} km of the meeting point to start. You are {distanceToMeetingPoint.toFixed(1)} km away.
                </Text>
              )}
              {!hasActiveRideOnThisRoute && hasEnoughParticipants && meetingPoint && distanceToMeetingPoint === null && (
                <Text style={styles.controlWarning} data-testid={`control-warning-location-${item.id}`}>
                  Enable location access to measure your distance to the meeting point.
                </Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderRoute = ({ item }: { item: RouteOut }) => renderRouteCard(item, { testIdPrefix: "route-card-list" });

  const exploreHeader = activeTab === "explore" ? (
      <View style={styles.exploreHeaderSections}>
        <View style={styles.sectionHeaderRow} data-testid="created-by-users-section-header">
          <View>
            <Text style={styles.sectionTitle}>Created by users</Text>
            <Text style={styles.sectionSubtitle}>Routes within 100 km of your location</Text>
          </View>
        </View>

        {userLocation ? (
          nearbyUserCreatedRoutes.length > 0 ? (
            <FlatList
              data={nearbyUserCreatedRoutes}
              horizontal
              keyExtractor={(item) => `created-by-user-${item.id}`}
              renderItem={({ item }) =>
                renderRouteCard(item, {
                  layout: "horizontal",
                  testIdPrefix: "route-card-created-by-users",
                })
              }
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRoutesContent}
              data-testid="created-by-users-horizontal-list"
            />
          ) : (
            <View style={styles.emptyExploreCard} data-testid="created-by-users-empty-state">
              <Ionicons name="trail-sign-outline" size={22} color={Colors.accent} />
              <Text style={styles.emptyExploreTitle}>No nearby user-created routes yet</Text>
              <Text style={styles.emptyExploreText}>Move the map or create a new route to populate this section.</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyExploreCard} data-testid="created-by-users-location-required">
            <Ionicons name="locate-outline" size={22} color={Colors.accent} />
            <Text style={styles.emptyExploreTitle}>Location needed</Text>
            <Text style={styles.emptyExploreText}>Enable location to show routes created by users within 100 km.</Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow} data-testid="recommendation-of-the-day-section-header">
          <View>
            <Text style={styles.sectionTitle}>Recommendation of the day</Text>
            <Text style={styles.sectionSubtitle}>Daily curated picks for premium riders</Text>
          </View>
        </View>

        <View style={styles.premiumLockedCard} data-testid="routes-recommendation-premium-card">
          <View style={styles.premiumGlow} />
          <View style={styles.premiumBadge}>
            <Ionicons name="sparkles" size={14} color={Colors.accent} />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
          <View style={styles.premiumLockedIconWrap}>
            <Ionicons name="lock-closed" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.premiumLockedTitle}>Available with Moto Go Premium</Text>
          <Text style={styles.premiumLockedText}>
            Unlock the daily ride recommendation, distance-aware picks, and premium curation.
          </Text>
        </View>
      </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>{t("routes.title")}</Text>
          <Text style={styles.sub}>{t("routes.subtitle")}</Text>
        </View>
        <Pressable
          style={styles.createBtn}
          onPress={() => router.push("/create/route")}
        >
          <Ionicons name="add" size={24} color={Colors.bg} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("routes.searchRoutes")}
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "explore" && styles.tabActive]}
          onPress={() => setActiveTab("explore")}
        >
          <Ionicons 
            name="compass-outline" 
            size={18} 
            color={activeTab === "explore" ? Colors.bg : Colors.muted} 
          />
          <Text style={[styles.tabText, activeTab === "explore" && styles.tabTextActive]}>
            {t("routes.explore")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "my" && styles.tabActive]}
          onPress={() => setActiveTab("my")}
        >
          <Ionicons 
            name="bookmark-outline" 
            size={18} 
            color={activeTab === "my" ? Colors.bg : Colors.muted} 
          />
          <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
            {t("routes.myRoutes")} ({myRoutes.length})
          </Text>
        </Pressable>
      </View>

      {/* Routes List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRoute}
          ListHeaderComponent={exploreHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trail-sign-outline" size={64} color={Colors.muted} />
              <Text style={styles.emptyTitle}>
                {activeTab === "my" ? t("routes.noRoutesFound") : t("routes.noRoutesFound")}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === "my" 
                  ? t("routes.startNewAdventure")
                  : t("common.noResults")}
              </Text>
              {activeTab === "my" && (
                <Pressable
                  style={styles.createFirstBtn}
                  onPress={() => router.push("/create/route")}
                >
                  <Ionicons name="add" size={20} color={Colors.bg} />
                  <Text style={styles.createFirstBtnText}>{t("routes.createRoute")}</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  createBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  // Tabs
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  tabTextActive: {
    color: Colors.bg,
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  exploreHeaderSections: {
    gap: 16,
    paddingBottom: 18,
  },
  sectionHeaderRow: {
    gap: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  sectionSubtitle: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  horizontalRoutesContent: {
    paddingRight: 4,
  },
  emptyExploreCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  emptyExploreTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  emptyExploreText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  premiumLockedCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(6, 10, 10, 0.92)",
    borderWidth: 1,
    borderColor: `${Colors.accent}55`,
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    gap: 12,
    shadowColor: Colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  premiumGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: `${Colors.accent}18`,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(7, 13, 13, 0.75)",
    borderWidth: 1,
    borderColor: `${Colors.accent}35`,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  premiumBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  premiumLockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(18, 30, 25, 0.94)",
    borderWidth: 1,
    borderColor: `${Colors.accent}45`,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  premiumLockedTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
    textAlign: "center",
  },
  premiumLockedText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  
  // Route Card
  routeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  routeMapContainer: {
    height: 140,
    backgroundColor: Colors.card2,
  },
  difficultyBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  difficultyEasy: {
    backgroundColor: "rgba(34, 197, 94, 0.9)",
  },
  difficultyMedium: {
    backgroundColor: "rgba(245, 158, 11, 0.9)",
  },
  difficultyHard: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
  },
  difficultyText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "capitalize",
  },
  routeInfo: {
    padding: 14,
    gap: 8,
  },
  routeTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  routeMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  routeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeMetaText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  routeLocationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeLocation: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  routeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  routeStats: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  ownerBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownerBadgeText: {
    color: Colors.bg,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  
  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
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
  },
  createFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  createFirstBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  
  // Active Ride Badge
  activeRideBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.success,
  },
  pausedRideBadge: {
    backgroundColor: "#FFC107",
  },
  activeRideBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  
  // Control Panel
  controlPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  controlPanelTitle: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  meetingPointCard: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  meetingPointHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meetingPointTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  meetingPointTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  meetingRadiusBadge: {
    backgroundColor: `${Colors.accent}20`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  meetingRadiusText: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  meetingPointAddress: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  meetingPointMetaRow: {
    gap: 10,
  },
  meetingDistancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Colors.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  meetingDistanceText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  navigateMeetingPointBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navigateMeetingPointText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  controlButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  controlBtnDisabled: {
    opacity: 0.5,
  },
  controlBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  startBtn: {
    backgroundColor: Colors.success,
  },
  pauseBtn: {
    backgroundColor: "#FFC107",
  },
  resumeBtn: {
    backgroundColor: Colors.success,
  },
  endBtn: {
    backgroundColor: Colors.danger,
  },
  directionsBtn: {
    backgroundColor: Colors.accent,
  },
  controlWarning: {
    color: Colors.danger,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
});

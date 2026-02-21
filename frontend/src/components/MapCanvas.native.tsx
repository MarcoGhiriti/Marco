import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import { Callout, CalloutSubview, Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

const openDirections = (lat: number, lng: number, label: string) => {
  const encoded = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${encoded}@${lat},${lng}`,
    android: `google.navigation:q=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  Linking.openURL(url as string);
};

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapEvent = {
  id: string;
  title: string;
  start_point: number[];
  location_name?: string;
};

type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  place_type: string;
};

type PoliceReport = {
  id: string;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
};

type FriendMarker = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
  lat: number;
  lng: number;
  updated_at: string;
  active_ride?: {
    route_id: string;
    route_title: string;
    started_at: string;
  } | null;
  distance_km?: number | null;
};

type MapCanvasProps = {
  mapRef: React.RefObject<any>;
  region: MapRegion;
  onRegionChangeComplete: (region: MapRegion) => void;
  onPanDrag: () => void;
  onRecenter: () => void;
  onSearchArea: () => void;
  showSearchArea: boolean;
  events: MapEvent[];
  gasMarkers: MapPlace[];
  policeReports: PoliceReport[];
  showEvents: boolean;
  showGas: boolean;
  showService: boolean;
  showFriends: boolean;
  friendMarkers: FriendMarker[];
  onToggleEvents: () => void;
  onToggleGas: () => void;
  onToggleService: () => void;
  onToggleFriends: () => void;
  onReportPolice: () => void;
  onVotePolice: (reportId: string, vote: "up" | "down", lat: number, lng: number) => void;
  isFetching: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onEventPress?: (eventId: string) => void;
  onFriendPress?: (friendId: string) => void;
  onFriendProfilePress?: (friendId: string) => void;
};

const MAP_STYLE = [
  // Base map - slightly lighter for better road visibility
  { elementType: "geometry", stylers: [{ color: "#0f1413" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8c9a94" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1413" }] },
  
  // Hide administrative boundaries for cleaner look
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ visibility: "on" }, { color: "#2d3a36" }] },
  
  // Points of interest - minimal
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#111b18" }] },
  
  // Roads - clearer contrast
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b3431" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2623" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9aa7a0" }] },
  
  // Highways - prominent with accent glow
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4a45" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#46f2ae" }, { weight: 1.2 }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#46f2ae" }] },
  
  // Arterial roads - secondary accent
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#313c38" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#3f4a46" }] },
  
  // Local roads
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#242c29" }] },
  
  // Water - deep blue-green
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1714" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#2c3e38" }] },
  
  // Landscape - subtle terrain
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#101615" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#121a18" }] },
  
  // Transit - hidden
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const FAB_BOTTOM = Platform.OS === "ios" ? 110 : 90;

const FriendMarkerView = ({ friend }: { friend: FriendMarker }) => {
  const initial = (friend.username || "?")[0].toUpperCase();
  const now = new Date();
  const updatedAt = new Date(friend.updated_at);
  const minutesAgo = (now.getTime() - updatedAt.getTime()) / 60000;
  const isLive = minutesAgo < 5;

  return (
    <View style={fmStyles.wrap}>
      <View style={[fmStyles.circle, !isLive && fmStyles.circleOffline]}>
        <Text style={[fmStyles.initial, !isLive && fmStyles.initialOffline]}>{initial}</Text>
      </View>
      <View style={[fmStyles.dot, isLive ? fmStyles.dotLive : fmStyles.dotOffline]} />
      <Text style={fmStyles.name} numberOfLines={1}>{friend.username}</Text>
    </View>
  );
};

const fmStyles = StyleSheet.create({
  wrap: { alignItems: "center", width: 52 },
  circle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.bg,
  },
  circleOffline: { backgroundColor: "#555", opacity: 0.6 },
  initial: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  initialOffline: { color: "#999" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: -6, borderWidth: 1.5, borderColor: Colors.bg },
  dotLive: { backgroundColor: Colors.accent },
  dotOffline: { backgroundColor: "#888" },
  name: { color: Colors.text, fontSize: 9, fontFamily: "Inter_600SemiBold", marginTop: 2, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});

export default function MapCanvas({
  mapRef,
  region,
  onRegionChangeComplete,
  onPanDrag,
  onRecenter,
  onSearchArea,
  showSearchArea,
  events,
  gasMarkers,
  policeReports,
  showEvents,
  showGas,
  showService,
  showFriends,
  friendMarkers,
  onToggleEvents,
  onToggleGas,
  onToggleService,
  onToggleFriends,
  onReportPolice,
  onVotePolice,
  isFetching,
  userLocation,
  onEventPress,
  onFriendPress,
  onFriendProfilePress,
}: MapCanvasProps) {
  const searchAnim = useRef(new Animated.Value(showSearchArea ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: showSearchArea ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showSearchArea, searchAnim]);

  const searchStyle = useMemo(
    () => ({
      opacity: searchAnim,
      transform: [
        {
          scale: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
          }),
        },
      ],
    }),
    [searchAnim]
  );

  return (
    <View style={styles.mapWrapper}>
      <ClusteredMapView
        style={StyleSheet.absoluteFill}
        ref={mapRef}
        region={region}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={onRegionChangeComplete}
        customMapStyle={MAP_STYLE}
        clusterColor={Colors.accent}
        clusterTextColor={Colors.bg}
        clusterBorderColor={Colors.bg}
        spiralEnabled
      >
        {/* User location marker */}
        {userLocation && (
          <Marker
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userDotOuter}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        )}

        {showEvents &&
          events.map((event) => {
            const [lat, lng] = event.start_point || [];
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return (
              <Marker
                key={`event-${event.id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                pinColor={Colors.accent}
              >
                <Callout tooltip onPress={() => onEventPress?.(event.id)}>
                  <View style={styles.placeCallout} data-testid={`event-callout-${event.id}`}>
                    <View style={styles.placeCalloutHeader}>
                      <Ionicons name="calendar" size={14} color={Colors.accent} />
                      <Text style={styles.placeCalloutName} numberOfLines={1} data-testid={`event-callout-title-${event.id}`}>{event.title}</Text>
                    </View>
                    {event.location_name && (
                      <Text style={styles.eventLocationText} numberOfLines={1} data-testid={`event-callout-location-${event.id}`}>{event.location_name}</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable style={styles.directionsBtn} onPress={() => onEventPress?.(event.id)} data-testid={`event-callout-details-${event.id}`}>
                        <Ionicons name="eye" size={14} color={Colors.bg} />
                        <Text style={styles.directionsBtnText}>Detalii</Text>
                      </Pressable>
                      <Pressable style={[styles.directionsBtn, { backgroundColor: "#4A90D9" }]} onPress={() => openDirections(lat, lng, event.title)} data-testid={`event-callout-directions-${event.id}`}>
                        <Ionicons name="navigate" size={14} color={Colors.bg} />
                        <Text style={styles.directionsBtnText}>Direcții</Text>
                      </Pressable>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          })}

        {showGas &&
          gasMarkers
            .filter((place) => place.place_type === "gas")
            .map((place) => (
            <Marker
              key={`place-${place.id}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              pinColor="#FFB020"
            >
              <Callout tooltip onPress={() => openDirections(place.lat, place.lng, place.name)}>
                <View style={styles.placeCallout} data-testid={`place-callout-${place.id}`}>
                  <View style={styles.placeCalloutHeader}>
                    <Ionicons name="flame" size={14} color="#FFB020" />
                    <Text style={styles.placeCalloutName} numberOfLines={1} data-testid={`place-callout-name-${place.id}`}>{place.name}</Text>
                  </View>
                  <View style={styles.directionsBtn}>
                    <Ionicons name="navigate" size={14} color={Colors.bg} />
                    <Text style={styles.directionsBtnText}>Directions</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}

        {showService &&
          gasMarkers
            .filter((place) => place.place_type === "service")
            .map((place) => (
            <Marker
              key={`svc-${place.id}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              pinColor="#4A90D9"
            >
              <Callout tooltip onPress={() => openDirections(place.lat, place.lng, place.name)}>
                <View style={styles.placeCallout} data-testid={`place-callout-${place.id}`}>
                  <View style={styles.placeCalloutHeader}>
                    <Ionicons name="build" size={14} color="#4A90D9" />
                    <Text style={styles.placeCalloutName} numberOfLines={1} data-testid={`place-callout-name-${place.id}`}>{place.name}</Text>
                  </View>
                  <View style={[styles.directionsBtn, { backgroundColor: "#4A90D9" }]}>
                    <Ionicons name="navigate" size={14} color={Colors.bg} />
                    <Text style={styles.directionsBtnText}>Directions</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}

        {showFriends &&
          friendMarkers.map((friend) => (
            <Marker
              key={`friend-${friend.id}`}
              coordinate={{ latitude: friend.lat, longitude: friend.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              cluster={false}
            >
              <FriendMarkerView friend={friend} />
              <Callout tooltip>
                <View style={styles.friendCalloutCard} data-testid={`friend-callout-card-${friend.id}`}>
                  {Platform.OS === "ios" ? (
                    <CalloutSubview
                      onPress={() => onFriendProfilePress?.(friend.id)}
                      data-testid={`friend-callout-profile-${friend.id}`}
                    >
                      <View style={styles.friendCalloutHeader} data-testid={`friend-callout-profile-inner-${friend.id}`}>
                        {friend.profile_photo_base64 ? (
                          <Image
                            source={{ uri: `data:image/jpeg;base64,${friend.profile_photo_base64}` }}
                            style={styles.friendCalloutPhoto}
                          />
                        ) : (
                          <View style={[styles.friendCalloutPhoto, styles.friendCalloutPhotoPlaceholder]}>
                            <Ionicons name="person" size={20} color={Colors.text} />
                          </View>
                        )}
                        <View style={styles.friendCalloutInfo}>
                          <Text style={styles.friendCalloutName} data-testid={`friend-callout-name-${friend.id}`}>
                            {friend.username}
                          </Text>
                          {friend.active_ride && (
                            <View style={styles.friendRideStatus}>
                              <Ionicons name="navigate" size={10} color={Colors.accent} />
                              <Text style={styles.friendRideText} numberOfLines={1} data-testid={`friend-callout-ride-${friend.id}`}>
                                On route: {friend.active_ride.route_title}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </CalloutSubview>
                  ) : (
                    <Pressable
                      style={styles.friendCalloutHeader}
                      onPress={() => onFriendProfilePress?.(friend.id)}
                      data-testid={`friend-callout-profile-${friend.id}`}
                    >
                      {friend.profile_photo_base64 ? (
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${friend.profile_photo_base64}` }}
                          style={styles.friendCalloutPhoto}
                        />
                      ) : (
                        <View style={[styles.friendCalloutPhoto, styles.friendCalloutPhotoPlaceholder]}>
                          <Ionicons name="person" size={20} color={Colors.text} />
                        </View>
                      )}
                      <View style={styles.friendCalloutInfo}>
                        <Text style={styles.friendCalloutName} data-testid={`friend-callout-name-${friend.id}`}>
                          {friend.username}
                        </Text>
                        {friend.active_ride && (
                          <View style={styles.friendRideStatus}>
                            <Ionicons name="navigate" size={10} color={Colors.accent} />
                            <Text style={styles.friendRideText} numberOfLines={1} data-testid={`friend-callout-ride-${friend.id}`}>
                              On route: {friend.active_ride.route_title}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  )}
                  <View style={styles.friendCalloutFooter}>
                    <View style={styles.friendDistanceBox}>
                      <Ionicons name="location" size={12} color={Colors.accent} />
                      <Text style={styles.friendDistanceText} data-testid={`friend-callout-distance-${friend.id}`}>
                        {friend.distance_km != null ? `${friend.distance_km} km` : "-- km"}
                      </Text>
                    </View>
                    {Platform.OS === "ios" ? (
                      <CalloutSubview
                        onPress={() => onFriendPress?.(friend.id)}
                        data-testid={`friend-callout-message-${friend.id}`}
                      >
                        <View style={styles.friendMessageBtn} data-testid={`friend-callout-message-inner-${friend.id}`}>
                          <Ionicons name="chatbubble" size={14} color={Colors.bg} />
                        </View>
                      </CalloutSubview>
                    ) : (
                      <Pressable
                        style={styles.friendMessageBtn}
                        onPress={() => onFriendPress?.(friend.id)}
                        data-testid={`friend-callout-message-${friend.id}`}
                      >
                        <Ionicons name="chatbubble" size={14} color={Colors.bg} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}

        {policeReports.map((report) => (
          <Marker
            key={`police-${report.id}`}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            pinColor="#FF3B30"
          >
            <Callout tooltip>
              <View style={styles.calloutCard} data-testid={`police-report-callout-${report.id}`}>
                <Text style={styles.calloutTitle} data-testid={`police-report-title-${report.id}`}>Police report</Text>
                <View style={styles.voteRow}>
                  <Pressable
                    style={[styles.voteBtn, styles.voteUp]}
                    onPress={() => onVotePolice(report.id, "up", report.lat, report.lng)}
                    data-testid={`police-vote-up-${report.id}`}
                  >
                    <Ionicons name="thumbs-up" size={14} color={Colors.bg} />
                    <Text style={styles.voteText} data-testid={`police-upvotes-${report.id}`}>{report.upvotes}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.voteBtn, styles.voteDown]}
                    onPress={() => onVotePolice(report.id, "down", report.lat, report.lng)}
                    data-testid={`police-vote-down-${report.id}`}
                  >
                    <Ionicons name="thumbs-down" size={14} color={Colors.bg} />
                    <Text style={styles.voteText} data-testid={`police-downvotes-${report.id}`}>{report.downvotes}</Text>
                  </Pressable>
                </View>
                <Text style={styles.calloutHint} data-testid={`police-callout-hint-${report.id}`}>Still there?</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </ClusteredMapView>

      <View style={styles.filtersRow}>
        {/* Subtle loading indicator - no blocking overlay */}
        {isFetching && (
          <View style={styles.loadingDot} data-testid="map-loading-dot" />
        )}
        <Pressable
          style={[styles.filterChip, showEvents && styles.filterChipActive]}
          onPress={onToggleEvents}
          data-testid="filter-events"
        >
          <Ionicons name="calendar" size={18} color={showEvents ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showGas && styles.filterChipActiveGas]}
          onPress={onToggleGas}
          data-testid="filter-gas"
        >
          <Ionicons name="flame" size={18} color={showGas ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showService && styles.filterChipActiveService]}
          onPress={onToggleService}
          data-testid="filter-service"
        >
          <Ionicons name="build" size={18} color={showService ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showFriends && styles.filterChipActiveFriends]}
          onPress={onToggleFriends}
          data-testid="filter-friends"
        >
          <Ionicons name="people" size={18} color={showFriends ? Colors.bg : Colors.text} />
        </Pressable>
      </View>

      <Animated.View
        style={[styles.searchButton, searchStyle]}
        pointerEvents={showSearchArea ? "auto" : "none"}
      >
        <Pressable onPress={onSearchArea} style={styles.searchPressable} data-testid="search-this-area">
          <Text style={styles.searchText}>Search this area</Text>
        </Pressable>
      </Animated.View>

      {/* Floating action buttons - responsive positioned */}
      <View style={styles.fabContainer}>
        <Pressable style={styles.reportFab} onPress={onReportPolice} data-testid="report-police-btn">
          <Ionicons name="shield" size={18} color={Colors.bg} />
          <Text style={styles.reportFabText}>Report Police</Text>
        </Pressable>
        <Pressable style={styles.recenterBtn} onPress={onRecenter} data-testid="recenter-btn">
          <Ionicons name="locate" size={18} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,7,0.35)",
  },
  loadingDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.bg,
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  filtersRow: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    gap: 10,
  },
  filterChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipActiveGas: {
    backgroundColor: "#FFB020",
    borderColor: "#FFB020",
  },
  filterChipActiveService: {
    backgroundColor: "#4A90D9",
    borderColor: "#4A90D9",
  },
  filterChipActiveFriends: {
    backgroundColor: "#9B59B6",
    borderColor: "#9B59B6",
  },
  searchButton: {
    position: "absolute",
    top: 72,
    alignSelf: "center",
  },
  searchPressable: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchText: { color: Colors.text, fontSize: 12, fontFamily: "Inter_700Bold" },
  fabContainer: {
    position: "absolute",
    bottom: FAB_BOTTOM,
    right: 16,
    gap: 10,
    alignItems: "flex-end",
    zIndex: 20,
    elevation: 10,
  },
  recenterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  reportFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reportFabText: { color: Colors.bg, fontSize: 11, fontFamily: "Inter_700Bold" },
  calloutCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 140,
    alignItems: "center",
    gap: 6,
  },
  calloutTitle: { color: Colors.text, fontSize: 12, fontFamily: "Inter_700Bold" },
  calloutHint: { color: Colors.muted, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  voteRow: { flexDirection: "row", gap: 8 },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  voteUp: { backgroundColor: Colors.accent },
  voteDown: { backgroundColor: "#FF3B30" },
  voteText: { color: Colors.bg, fontSize: 11, fontFamily: "Inter_700Bold" },
  placeCallout: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 160,
    alignItems: "center",
    gap: 8,
  },
  placeCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  placeCalloutName: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    maxWidth: 130,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  directionsBtnText: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  eventLocationText: {
    color: Colors.muted,
    fontSize: 10,
    maxWidth: 150,
  },
  userDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 122, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "#fff",
  },
  // Friend Callout Styles
  friendCalloutCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 200,
    gap: 10,
  },
  friendCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  friendCalloutPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  friendCalloutPhotoPlaceholder: {
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  friendCalloutInfo: {
    flex: 1,
    gap: 4,
  },
  friendCalloutName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  friendRideStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(54, 241, 154, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  friendRideText: {
    color: Colors.accent,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 100,
  },
  friendCalloutFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendDistanceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  friendDistanceText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  friendMessageBtn: {
    backgroundColor: Colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
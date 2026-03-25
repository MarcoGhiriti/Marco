import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const haversineDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
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

type MeetingPointMarker = {
  id: string;
  route_id?: string;
  type: "route" | "live_ride";
  name: string;
  route_title?: string;
  address?: string;
  lat: number;
  lng: number;
  difficulty?: string;
  distance_km?: number | null;
  start_radius_km?: number;
  start_time?: string;
};

type MapOverlaySelection =
  | { kind: "event"; data: MapEvent; lat: number; lng: number }
  | { kind: "place"; data: MapPlace }
  | { kind: "police"; data: PoliceReport };

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
  showRoutes?: boolean;
  showLiveRides?: boolean;
  routeMarkers?: MeetingPointMarker[];
  rideMarkers?: MeetingPointMarker[];
  onToggleRoutes?: () => void;
  onToggleLiveRides?: () => void;
  onRoutePress?: (routeId: string) => void;
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
const ClusterCompatibleMarker = Marker as any;

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


const mpStyles = StyleSheet.create({
  routePin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: Colors.accent, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 8,
  },
  ridePin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#FF6B35", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#FF6B35", shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 8,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, width: 280,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
    alignSelf: "center",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  typeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: Colors.muted, fontSize: 12, fontWeight: "600" },
  viewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4,
    flexGrow: 1,
  },
  viewBtnText: { color: Colors.bg, fontSize: 13, fontWeight: "700" },
  cardHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  cardRouteTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  cardAddress: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaBadgeText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.card2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  directionsBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
});

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
  showRoutes,
  showLiveRides,
  routeMarkers = [],
  rideMarkers = [],
  onToggleRoutes,
  onToggleLiveRides,
  onRoutePress,
}: MapCanvasProps) {
  const searchAnim = useRef(new Animated.Value(showSearchArea ? 1 : 0)).current;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const popupWidth = Math.min(Math.max(screenWidth * 0.72, 220), 300);
  const [selectedFriend, setSelectedFriend] = useState<FriendMarker | null>(null);
  const [selectedMP, setSelectedMP] = useState<MeetingPointMarker | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<MapOverlaySelection | null>(null);
  const popupBottomPadding = Math.max(insets.bottom + 88, 112);

  const clearSelections = () => {
    setSelectedOverlay(null);
    setSelectedFriend(null);
    setSelectedMP(null);
  };

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
        onPanDrag={() => {
          clearSelections();
          onPanDrag();
        }}
        onPress={clearSelections}
        onRegionChangeComplete={onRegionChangeComplete}
        customMapStyle={MAP_STYLE}
        clusterColor={Colors.accent}
        clusterTextColor={Colors.bg}
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
                onPress={() => {
                  setSelectedFriend(null);
                  setSelectedMP(null);
                  setSelectedOverlay({ kind: "event", data: event, lat, lng });
                }}
              />
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
              onPress={() => {
                setSelectedFriend(null);
                setSelectedMP(null);
                setSelectedOverlay({ kind: "place", data: place });
              }}
            />
          ))}

        {showService &&
          gasMarkers
            .filter((place) => place.place_type === "service")
            .map((place) => (
            <Marker
              key={`svc-${place.id}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              pinColor="#4A90D9"
              onPress={() => {
                setSelectedFriend(null);
                setSelectedMP(null);
                setSelectedOverlay({ kind: "place", data: place });
              }}
            />
          ))}

        {showFriends &&
          friendMarkers.map((friend) => (
            <ClusterCompatibleMarker
              key={`friend-${friend.id}`}
              coordinate={{ latitude: friend.lat, longitude: friend.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              cluster={false}
              onPress={() => {
                setSelectedOverlay(null);
                setSelectedFriend(friend);
                setSelectedMP(null);
              }}
            >
              <FriendMarkerView friend={friend} />
            </ClusterCompatibleMarker>
          ))}

        {policeReports.map((report) => (
          <Marker
            key={`police-${report.id}`}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            pinColor="#FF3B30"
            onPress={() => {
              setSelectedFriend(null);
              setSelectedMP(null);
              setSelectedOverlay({ kind: "police", data: report });
            }}
          />
        ))}

        {/* Route Meeting Point Markers */}
        {showRoutes && routeMarkers.map((rm) => (
          <Marker
            key={`route-mp-${rm.id}`}
            coordinate={{ latitude: rm.lat, longitude: rm.lng }}
            tracksViewChanges={false}
            onPress={() => {
              setSelectedOverlay(null);
              setSelectedMP(rm);
              setSelectedFriend(null);
            }}
          >
            <View style={mpStyles.routePin}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </Marker>
        ))}

        {/* Live Ride Meeting Point Markers */}
        {showLiveRides && rideMarkers.map((rm) => (
          <Marker
            key={`ride-mp-${rm.id}`}
            coordinate={{ latitude: rm.lat, longitude: rm.lng }}
            tracksViewChanges={false}
            onPress={() => {
              setSelectedOverlay(null);
              setSelectedMP(rm);
              setSelectedFriend(null);
            }}
          >
            <View style={mpStyles.ridePin}>
              <Ionicons name="bicycle" size={14} color="#fff" />
            </View>
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
        <Pressable
          style={[styles.filterChip, showRoutes && styles.filterChipActiveRoutes]}
          onPress={onToggleRoutes}
          data-testid="filter-routes"
        >
          <Ionicons name="map" size={18} color={showRoutes ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showLiveRides && styles.filterChipActiveRides]}
          onPress={onToggleLiveRides}
          data-testid="filter-live-rides"
        >
          <Ionicons name="bicycle" size={18} color={showLiveRides ? Colors.bg : Colors.text} />
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
          <Ionicons name="locate" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      {selectedOverlay && (
        <Pressable
          style={[styles.meetingPointOverlayBackdrop, { paddingBottom: popupBottomPadding, paddingHorizontal: 12 }]}
          onPress={() => setSelectedOverlay(null)}
        >
          <Pressable
            style={[styles.meetingPointCallout, { width: popupWidth }]}
            onPress={(e) => e.stopPropagation()}
            data-testid={`map-overlay-card-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
          >
            <View style={styles.popupHandle} />
            <View style={styles.mapOverlayHeader}>
              <View
                style={[
                  styles.mapOverlayBadge,
                  selectedOverlay.kind === "event"
                    ? styles.mapOverlayBadgeEvent
                    : selectedOverlay.kind === "police"
                      ? styles.mapOverlayBadgePolice
                      : selectedOverlay.data.place_type === "gas"
                        ? styles.mapOverlayBadgeGas
                        : styles.mapOverlayBadgeService,
                ]}
              >
                <Ionicons
                  name={
                    selectedOverlay.kind === "event"
                      ? "calendar"
                      : selectedOverlay.kind === "police"
                        ? "shield"
                        : selectedOverlay.data.place_type === "gas"
                          ? "flame"
                          : "build"
                  }
                  size={12}
                  color={Colors.bg}
                />
                <Text style={styles.mapOverlayBadgeText}>
                  {selectedOverlay.kind === "event"
                    ? "Event"
                    : selectedOverlay.kind === "police"
                      ? "Police report"
                      : selectedOverlay.data.place_type === "gas"
                        ? "Gas station"
                        : "Service"}
                </Text>
              </View>
            </View>

            <Text
              style={styles.meetingPointCalloutTitle}
              numberOfLines={2}
              data-testid={`map-overlay-title-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
            >
              {selectedOverlay.kind === "event"
                ? selectedOverlay.data.title
                : selectedOverlay.kind === "police"
                  ? "Police report"
                  : selectedOverlay.data.name}
            </Text>

            {selectedOverlay.kind === "event" && selectedOverlay.data.location_name ? (
              <Text
                style={styles.meetingPointCalloutMeta}
                numberOfLines={2}
                data-testid={`map-overlay-subtitle-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
              >
                {selectedOverlay.data.location_name}
              </Text>
            ) : null}

            {selectedOverlay.kind === "place" ? (
              <Text
                style={styles.meetingPointCalloutMeta}
                data-testid={`map-overlay-subtitle-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
              >
                {selectedOverlay.data.place_type === "gas" ? "Fuel stop nearby" : "Service point nearby"}
              </Text>
            ) : null}

            <Text
              style={styles.meetingPointCalloutMeta}
              data-testid={`map-overlay-distance-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
            >
              {userLocation
                ? `${haversineDistanceKm(
                    userLocation.lat,
                    userLocation.lng,
                    selectedOverlay.kind === "event"
                      ? selectedOverlay.lat
                      : selectedOverlay.data.lat,
                    selectedOverlay.kind === "event"
                      ? selectedOverlay.lng
                      : selectedOverlay.data.lng,
                  ).toFixed(1)} km from you`
                : "Enable location to see distance"}
            </Text>

            {selectedOverlay.kind === "police" ? (
              <>
                <View style={styles.voteRow}>
                  <Pressable
                    style={[styles.voteBtn, styles.voteUp]}
                    onPress={() => onVotePolice(selectedOverlay.data.id, "up", selectedOverlay.data.lat, selectedOverlay.data.lng)}
                    data-testid={`police-vote-up-${selectedOverlay.data.id}`}
                  >
                    <Ionicons name="thumbs-up" size={14} color={Colors.bg} />
                    <Text style={styles.voteText} data-testid={`police-upvotes-${selectedOverlay.data.id}`}>{selectedOverlay.data.upvotes}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.voteBtn, styles.voteDown]}
                    onPress={() => onVotePolice(selectedOverlay.data.id, "down", selectedOverlay.data.lat, selectedOverlay.data.lng)}
                    data-testid={`police-vote-down-${selectedOverlay.data.id}`}
                  >
                    <Ionicons name="thumbs-down" size={14} color={Colors.bg} />
                    <Text style={styles.voteText} data-testid={`police-downvotes-${selectedOverlay.data.id}`}>{selectedOverlay.data.downvotes}</Text>
                  </Pressable>
                </View>
                <Text style={styles.calloutHint} data-testid={`police-callout-hint-${selectedOverlay.data.id}`}>Still there?</Text>
              </>
            ) : (
              <View style={styles.meetingPointPopupActions}>
                <Pressable
                  style={styles.meetingPointPopupGhostBtn}
                  onPress={() =>
                    openDirections(
                      selectedOverlay.kind === "event" ? selectedOverlay.lat : selectedOverlay.data.lat,
                      selectedOverlay.kind === "event" ? selectedOverlay.lng : selectedOverlay.data.lng,
                      selectedOverlay.kind === "event" ? selectedOverlay.data.title : selectedOverlay.data.name,
                    )
                  }
                  data-testid={`map-overlay-directions-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
                >
                  <Ionicons name="navigate" size={14} color={Colors.text} />
                  <Text style={styles.meetingPointPopupGhostBtnText}>Directions</Text>
                </Pressable>
                {selectedOverlay.kind === "event" ? (
                  <Pressable
                    style={styles.calloutPrimaryBtn}
                    onPress={() => onEventPress?.(selectedOverlay.data.id)}
                    data-testid={`map-overlay-details-${selectedOverlay.kind}-${selectedOverlay.data.id}`}
                  >
                    <Ionicons name="eye" size={14} color={Colors.bg} />
                    <Text style={styles.calloutPrimaryBtnText}>Details</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Pressable>
        </Pressable>
      )}

      {selectedFriend && (
        <Pressable
          style={[styles.friendOverlayBackdrop, { paddingBottom: popupBottomPadding }]}
          onPress={() => setSelectedFriend(null)}
        >
          <Pressable
            style={[styles.friendPopupCard, { width: popupWidth }]}
            onPress={(e) => e.stopPropagation()}
            data-testid={`friend-popup-card-${selectedFriend.id}`}
          >
            <View style={styles.popupHandle} />
            <Pressable
              style={styles.friendPopupHeader}
              onPress={() => onFriendProfilePress?.(selectedFriend.id)}
              data-testid={`friend-popup-profile-${selectedFriend.id}`}
            >
              {selectedFriend.profile_photo_base64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${selectedFriend.profile_photo_base64}` }}
                  style={styles.friendPopupPhoto}
                />
              ) : (
                <View style={[styles.friendPopupPhoto, styles.friendPopupPhotoPlaceholder]}>
                  <Ionicons name="person" size={22} color={Colors.text} />
                </View>
              )}
              <View style={styles.friendPopupInfo}>
                <Text style={styles.friendPopupName} data-testid={`friend-popup-name-${selectedFriend.id}`}>
                  {selectedFriend.username}
                </Text>
                <Text style={styles.friendPopupHint}>Tap to view profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </Pressable>

            {selectedFriend.active_ride && (
              <View style={styles.friendPopupRideRow}>
                <Ionicons name="navigate" size={12} color={Colors.accent} />
                <Text style={styles.friendPopupRideText} numberOfLines={1}>
                  On route: {selectedFriend.active_ride.route_title}
                </Text>
              </View>
            )}

            <View style={styles.friendPopupFooter}>
              <View style={styles.friendPopupDistanceBox}>
                <Ionicons name="location" size={14} color={Colors.accent} />
                <Text style={styles.friendPopupDistanceText} data-testid={`friend-popup-distance-${selectedFriend.id}`}>
                  {selectedFriend.distance_km != null
                    ? `${selectedFriend.distance_km.toFixed(1)} km from you`
                    : userLocation
                      ? `${haversineDistanceKm(userLocation.lat, userLocation.lng, selectedFriend.lat, selectedFriend.lng).toFixed(1)} km from you`
                      : "Enable location to see distance"}
                </Text>
              </View>
              <Pressable
                style={styles.friendPopupChatBtn}
                onPress={() => onFriendPress?.(selectedFriend.id)}
                data-testid={`friend-popup-chat-${selectedFriend.id}`}
              >
                <Ionicons name="chatbubble" size={14} color={Colors.bg} />
                <Text style={styles.friendPopupChatText}>Chat</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}

      {selectedMP && (
        <Pressable
          style={[styles.meetingPointOverlayBackdrop, { paddingBottom: popupBottomPadding, paddingHorizontal: 12 }]}
          onPress={() => setSelectedMP(null)}
        >
          <Pressable
            style={[styles.meetingPointCallout, { width: popupWidth }]}
            onPress={(e) => e.stopPropagation()}
            data-testid={`meeting-point-popup-card-${selectedMP.id}`}
          >
            <View style={styles.popupHandle} />
            <View style={styles.meetingPointCalloutHeader}>
              <View style={[styles.meetingPointTypeBadge, selectedMP.type === "live_ride" && styles.liveRideTypeBadge]}>
                <Ionicons name={selectedMP.type === "route" ? "flag" : "bicycle"} size={12} color={Colors.bg} />
                <Text style={styles.meetingPointTypeText}>{selectedMP.type === "route" ? "Route" : "Live Ride"}</Text>
              </View>
              {selectedMP.difficulty ? <Text style={styles.meetingPointDifficultyText}>Difficulty: {selectedMP.difficulty}</Text> : null}
            </View>

            <Text style={styles.meetingPointCalloutTitle} numberOfLines={2} data-testid={`meeting-point-popup-title-${selectedMP.id}`}>
              {selectedMP.name}
            </Text>
            {selectedMP.route_title && selectedMP.route_title !== selectedMP.name ? (
              <Text style={styles.meetingPointCalloutSubtitle} numberOfLines={1}>
                {selectedMP.route_title}
              </Text>
            ) : null}
            {selectedMP.address ? (
              <Text style={styles.meetingPointCalloutMeta} numberOfLines={2} data-testid={`meeting-point-popup-address-${selectedMP.id}`}>
                {selectedMP.address}
              </Text>
            ) : null}
            <Text style={styles.meetingPointCalloutMeta} data-testid={`meeting-point-popup-distance-${selectedMP.id}`}>
              {userLocation
                ? `${haversineDistanceKm(userLocation.lat, userLocation.lng, selectedMP.lat, selectedMP.lng).toFixed(1)} km from you`
                : "Enable location to see distance"}
            </Text>

            <View style={styles.meetingPointPopupActions}>
              <Pressable
                style={styles.meetingPointPopupGhostBtn}
                onPress={() => openDirections(selectedMP.lat, selectedMP.lng, selectedMP.name || selectedMP.route_title || "Meeting point")}
                data-testid={`meeting-point-popup-directions-${selectedMP.id}`}
              >
                <Ionicons name="navigate" size={14} color={Colors.text} />
                <Text style={styles.meetingPointPopupGhostBtnText}>Directions</Text>
              </Pressable>
              <Pressable
                style={styles.calloutPrimaryBtn}
                onPress={() => onRoutePress?.(selectedMP.route_id ?? selectedMP.id)}
                data-testid={`meeting-point-popup-details-${selectedMP.id}`}
              >
                <Ionicons name="eye" size={14} color={Colors.bg} />
                <Text style={styles.calloutPrimaryBtnText}>Details</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    overflow: "hidden",
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
  filterChipActiveRoutes: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipActiveRides: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
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
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.accent + "40",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  friendMessageBtnText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  meetingPointCallout: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  meetingPointCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meetingPointTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveRideTypeBadge: {
    backgroundColor: "#FF6B35",
  },
  meetingPointTypeText: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  meetingPointDifficultyText: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meetingPointCalloutTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  meetingPointCalloutSubtitle: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  meetingPointCalloutMeta: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  meetingPointPopupActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  meetingPointPopupGhostBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.card2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  meetingPointPopupGhostBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  calloutPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 2,
    flex: 1,
  },
  calloutPrimaryBtnText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  mapOverlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapOverlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mapOverlayBadgeEvent: {
    backgroundColor: Colors.accent,
  },
  mapOverlayBadgeGas: {
    backgroundColor: "#FFB020",
  },
  mapOverlayBadgeService: {
    backgroundColor: "#4A90D9",
  },
  mapOverlayBadgePolice: {
    backgroundColor: "#FF3B30",
  },
  mapOverlayBadgeText: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  // Friend overlay popup styles (replacing Callout)
  friendOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 50,
    elevation: 50,
    justifyContent: "flex-end",
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  meetingPointOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 55,
    elevation: 55,
    justifyContent: "flex-end",
  },
  popupHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  friendPopupCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  friendPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendPopupPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  friendPopupPhotoPlaceholder: {
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  friendPopupInfo: {
    flex: 1,
    gap: 2,
  },
  friendPopupName: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  friendPopupHint: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  friendPopupRideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(54, 241, 154, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  friendPopupRideText: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  friendPopupFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  friendPopupDistanceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  friendPopupDistanceText: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  friendPopupChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  friendPopupChatText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
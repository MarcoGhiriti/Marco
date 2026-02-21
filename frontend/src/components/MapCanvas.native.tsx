import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import { Callout, Marker } from "react-native-maps";
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
};

const MAP_STYLE = [
  // Base map - deep dark with subtle green tint
  { elementType: "geometry", stylers: [{ color: "#0a0e0d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6b65" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e0d" }] },
  
  // Hide administrative boundaries for cleaner look
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ visibility: "on" }, { color: "#2a3a35" }] },
  
  // Points of interest - minimal
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f1613" }] },
  
  // Roads - the focus for motorcycle riders
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2622" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f1815" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#4a5a55" }] },
  
  // Highways - prominent with accent glow
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243830" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#36f19a", weight: 1.5 }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#36f19a" }] },
  
  // Arterial roads - secondary accent
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#1e2d28" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#2a4a40" }] },
  
  // Local roads
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#161f1c" }] },
  
  // Water - deep blue-green
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1512" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1a3530" }] },
  
  // Landscape - subtle terrain
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0d1210" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#0f1413" }] },
  
  // Transit - hidden
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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
                  <View style={styles.placeCallout}>
                    <View style={styles.placeCalloutHeader}>
                      <Ionicons name="calendar" size={14} color={Colors.accent} />
                      <Text style={styles.placeCalloutName} numberOfLines={1}>{event.title}</Text>
                    </View>
                    {event.location_name && (
                      <Text style={styles.eventLocationText} numberOfLines={1}>{event.location_name}</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable style={styles.directionsBtn} onPress={() => onEventPress?.(event.id)}>
                        <Ionicons name="eye" size={14} color={Colors.bg} />
                        <Text style={styles.directionsBtnText}>Detalii</Text>
                      </Pressable>
                      <Pressable style={[styles.directionsBtn, { backgroundColor: "#4A90D9" }]} onPress={() => openDirections(lat, lng, event.title)}>
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
                <View style={styles.placeCallout}>
                  <View style={styles.placeCalloutHeader}>
                    <Ionicons name="flame" size={14} color="#FFB020" />
                    <Text style={styles.placeCalloutName} numberOfLines={1}>{place.name}</Text>
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
                <View style={styles.placeCallout}>
                  <View style={styles.placeCalloutHeader}>
                    <Ionicons name="build" size={14} color="#4A90D9" />
                    <Text style={styles.placeCalloutName} numberOfLines={1}>{place.name}</Text>
                  </View>
                  <View style={[styles.directionsBtn, { backgroundColor: "#4A90D9" }]}>
                    <Ionicons name="navigate" size={14} color={Colors.bg} />
                    <Text style={styles.directionsBtnText}>Directions</Text>
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
              <View style={styles.calloutCard}>
                <Text style={styles.calloutTitle}>Police report</Text>
                <View style={styles.voteRow}>
                  <Pressable
                    style={[styles.voteBtn, styles.voteUp]}
                    onPress={() => onVotePolice(report.id, "up", report.lat, report.lng)}
                  >
                    <Ionicons name="thumbs-up" size={14} color={Colors.bg} />
                    <Text style={styles.voteText}>{report.upvotes}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.voteBtn, styles.voteDown]}
                    onPress={() => onVotePolice(report.id, "down", report.lat, report.lng)}
                  >
                    <Ionicons name="thumbs-down" size={14} color={Colors.bg} />
                    <Text style={styles.voteText}>{report.downvotes}</Text>
                  </Pressable>
                </View>
                <Text style={styles.calloutHint}>Still there?</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </ClusteredMapView>

      {isFetching && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}

      <View style={styles.filtersRow}>
        <Pressable
          style={[styles.filterChip, showEvents && styles.filterChipActive]}
          onPress={onToggleEvents}
        >
          <Ionicons name="calendar" size={18} color={showEvents ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showGas && styles.filterChipActiveGas]}
          onPress={onToggleGas}
        >
          <Ionicons name="flame" size={18} color={showGas ? Colors.bg : Colors.text} />
        </Pressable>
        <Pressable
          style={[styles.filterChip, showService && styles.filterChipActiveService]}
          onPress={onToggleService}
        >
          <Ionicons name="build" size={18} color={showService ? Colors.bg : Colors.text} />
        </Pressable>
      </View>

      <Animated.View
        style={[styles.searchButton, searchStyle]}
        pointerEvents={showSearchArea ? "auto" : "none"}
      >
        <Pressable onPress={onSearchArea} style={styles.searchPressable}>
          <Text style={styles.searchText}>Search this area</Text>
        </Pressable>
      </Animated.View>

      <Pressable style={styles.recenterBtn} onPress={onRecenter}>
        <Ionicons name="locate" size={18} color={Colors.text} />
      </Pressable>

      <Pressable style={styles.reportFab} onPress={onReportPolice}>
        <Ionicons name="shield" size={20} color={Colors.bg} />
        <Text style={styles.reportFabText}>Report Police</Text>
      </Pressable>
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
  searchButton: {
    position: "absolute",
    top: 16,
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
  recenterBtn: {
    position: "absolute",
    bottom: 90,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportFab: {
    position: "absolute",
    bottom: 150,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reportFabText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
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
});
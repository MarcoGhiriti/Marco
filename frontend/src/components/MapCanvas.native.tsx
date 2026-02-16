import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import { Callout, Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

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
  onToggleEvents: () => void;
  onToggleGas: () => void;
  onReportPolice: () => void;
  onVotePolice: (reportId: string, vote: "up" | "down", lat: number, lng: number) => void;
  isFetching: boolean;
};

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0f0e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8a86" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f0e" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#16221f" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f1815" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1d2f2a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#36f19a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1b18" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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
  onToggleEvents,
  onToggleGas,
  onReportPolice,
  onVotePolice,
  isFetching,
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
        {showEvents &&
          events.map((event) => {
            const [lat, lng] = event.start_point || [];
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return (
              <Marker
                key={`event-${event.id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                title={event.title}
                description={event.location_name}
                pinColor={Colors.accent}
              />
            );
          })}

        {showGas &&
          gasMarkers.map((place) => (
            <Marker
              key={`place-${place.id}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              pinColor={place.place_type === "gas" ? "#FFB020" : "#4A90D9"}
            />
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
          style={[styles.filterChip, showGas && styles.filterChipActive]}
          onPress={onToggleGas}
        >
          <Ionicons name="flame" size={18} color={showGas ? Colors.bg : Colors.text} />
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
        <Ionicons name="locate" size={18} color={Colors.bg} />
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
});
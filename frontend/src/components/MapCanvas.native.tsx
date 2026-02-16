import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

type EventMarker = {
  id: string;
  title: string;
  start_point: number[];
  start_time: string;
  location_name?: string;
};

type MapCanvasProps = {
  events: EventMarker[];
  loading: boolean;
  showEvents: boolean;
  onToggleEvents: (value: boolean) => void;
  onReportPolice: () => void;
};

const DEFAULT_REGION = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
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
  events,
  loading,
  showEvents,
  onToggleEvents,
  onReportPolice,
}: MapCanvasProps) {
  const initialRegion = useMemo(() => {
    if (events.length > 0) {
      const [lat, lng] = events[0].start_point || [];
      if (typeof lat === "number" && typeof lng === "number") {
        return {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        };
      }
    }
    return DEFAULT_REGION;
  }, [events]);

  return (
    <View style={styles.mapWrapper}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={MAP_STYLE}
      >
        {showEvents &&
          events.map((event) => {
            const [lat, lng] = event.start_point || [];
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return (
              <Marker
                key={event.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={event.title}
                description={event.location_name}
              />
            );
          })}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}

      {!loading && showEvents && events.length === 0 && (
        <View style={styles.emptyEvents}>
          <Ionicons name="calendar" size={20} color={Colors.muted} />
          <Text style={styles.emptyText}>No upcoming events</Text>
        </View>
      )}

      <Pressable
        style={[styles.eventToggle, showEvents && styles.eventToggleActive]}
        onPress={() => onToggleEvents(!showEvents)}
      >
        <Ionicons
          name="calendar"
          size={18}
          color={showEvents ? Colors.bg : Colors.text}
        />
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
  eventToggle: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventToggleActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  reportFab: {
    position: "absolute",
    bottom: 90,
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
  emptyEvents: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
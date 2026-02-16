import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Colors } from "../theme/colors";

type RouteMiniMapProps = {
  polyline?: number[][];
  startCity?: string;
  endCity?: string;
  height?: number;
  width?: number;
  color?: string;
};

const MINI_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#101615" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8da39c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#101615" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#242d2b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#141b19" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#303b38" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#394543" }] },
  { featureType: "administrative", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f1413" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1b18" }] },
];

export function RouteMiniMap({
  polyline = [],
  startCity,
  endCity,
  height = 110,
  width = 320,
  color = Colors.accent,
}: RouteMiniMapProps) {
  const safePolyline = Array.isArray(polyline) ? polyline : [];
  const coordinates = useMemo(
    () =>
      safePolyline
        .map((point) => {
          if (Array.isArray(point) && point.length >= 2) {
            return { latitude: point[0], longitude: point[1] };
          }
          if (typeof point === "object" && point && "lat" in point && "lng" in point) {
            return { latitude: (point as any).lat, longitude: (point as any).lng };
          }
          return null;
        })
        .filter(Boolean) as { latitude: number; longitude: number }[],
    [safePolyline]
  );

  const region = useMemo(() => {
    if (coordinates.length === 0) {
      return {
        latitude: 44.4268,
        longitude: 26.1025,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      };
    }
    const lats = coordinates.map((c) => c.latitude);
    const lngs = coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latitudeDelta = Math.max(0.05, (maxLat - minLat) * 1.6);
    const longitudeDelta = Math.max(0.05, (maxLng - minLng) * 1.6);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta,
      longitudeDelta,
    };
  }, [coordinates]);

  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1];

  return (
    <View style={[styles.container, { height, width }]}> 
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        customMapStyle={MINI_MAP_STYLE}
        mapType={Platform.OS === "android" ? "terrain" : "mutedStandard"}
        pointerEvents="none"
      >
        {coordinates.length > 1 && (
          <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={4} />
        )}
        {startCoord && (
          <Marker coordinate={startCoord} tracksViewChanges={false}>
            <View style={styles.markerWrap}>
              <View style={[styles.pin, styles.pinStart]} />
              {startCity ? (
                <View style={styles.cityTag}>
                  <Text style={styles.cityText}>{startCity}</Text>
                </View>
              ) : null}
            </View>
          </Marker>
        )}
        {endCoord && (
          <Marker coordinate={endCoord} tracksViewChanges={false}>
            <View style={styles.markerWrap}>
              <View style={[styles.pin, styles.pinEnd]} />
              {endCity ? (
                <View style={styles.cityTag}>
                  <Text style={styles.cityText}>{endCity}</Text>
                </View>
              ) : null}
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  markerWrap: {
    alignItems: "center",
    gap: 4,
  },
  pin: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pinStart: {
    backgroundColor: Colors.accent,
  },
  pinEnd: {
    backgroundColor: "#FF3B30",
  },
  cityTag: {
    backgroundColor: "rgba(10,15,14,0.85)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cityText: {
    color: Colors.text,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
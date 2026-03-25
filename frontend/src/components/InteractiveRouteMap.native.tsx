import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../theme/colors";

type Props = {
  polyline?: number[][];
  currentPoint?: { lat: number; lng: number } | null;
  stopPoints?: number[][];
  height?: number;
  dataTestId?: string;
};

const buildRegion = (coords: number[][]) => {
  if (!coords.length) {
    return {
      latitude: 44.4268,
      longitude: 26.1025,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }

  const lats = coords.map(([lat]) => lat);
  const lngs = coords.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
  };
};

export function InteractiveRouteMap({ polyline = [], currentPoint, stopPoints = [], height = 220, dataTestId }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const coords = useMemo(() => {
    if (polyline.length >= 2) return polyline;
    if (currentPoint) return [[currentPoint.lat, currentPoint.lng]];
    return [];
  }, [currentPoint, polyline]);

  const region = useMemo(() => buildRegion(coords), [coords]);

  return (
    <View style={[styles.wrap, { height }]} data-testid={dataTestId}>
      <MapView ref={mapRef} style={styles.map} initialRegion={region}>
        {polyline.length >= 2 ? (
          <Polyline coordinates={polyline.map(([latitude, longitude]) => ({ latitude, longitude }))} strokeColor={Colors.accent} strokeWidth={4} />
        ) : null}

        {polyline[0] ? (
          <Marker coordinate={{ latitude: polyline[0][0], longitude: polyline[0][1] }}>
            <View style={[styles.pointDot, styles.startDot]} />
          </Marker>
        ) : null}

        {stopPoints.map(([lat, lng], index) => (
          <Marker key={`${lat}-${lng}-${index}`} coordinate={{ latitude: lat, longitude: lng }}>
            <View style={styles.stopMarker} />
          </Marker>
        ))}

        {currentPoint ? (
          <Marker coordinate={{ latitude: currentPoint.lat, longitude: currentPoint.lng }}>
            <View style={[styles.pointDot, styles.currentDot]} />
          </Marker>
        ) : polyline.length >= 2 ? (
          <Marker coordinate={{ latitude: polyline[polyline.length - 1][0], longitude: polyline[polyline.length - 1][1] }}>
            <View style={[styles.pointDot, styles.endDot]} />
          </Marker>
        ) : null}
      </MapView>

      <Pressable
        style={styles.recenterBtn}
        onPress={() => {
          if (!mapRef.current) return;
          if (polyline.length >= 2) {
            mapRef.current.fitToCoordinates(polyline.map(([latitude, longitude]) => ({ latitude, longitude })), {
              animated: true,
              edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
            });
            return;
          }
          if (currentPoint) {
            mapRef.current.animateToRegion(buildRegion([[currentPoint.lat, currentPoint.lng]]), 250);
          }
        }}
        data-testid={`${dataTestId || "interactive-route-map"}-recenter-button`}
      >
        <Ionicons name="locate" size={18} color={Colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  map: { width: "100%", height: "100%" },
  recenterBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pointDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  startDot: { backgroundColor: Colors.success },
  currentDot: { backgroundColor: Colors.accent },
  endDot: { backgroundColor: Colors.danger },
  stopMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.warning,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Colors } from "../theme/colors";

type RoutePoint = {
  lat: number;
  lng: number;
};

type RouteMiniMapProps = {
  points: RoutePoint[];
  height?: number;
  width?: number;
  color?: string;
};

export function RouteMiniMap({
  points = [],
  height = 100,
  width = 300,
  color = Colors.accent,
}: RouteMiniMapProps) {
  const safePoints = Array.isArray(points) ? points : [];
  const coordinates = useMemo(
    () => safePoints.map((point) => ({ latitude: point.lat, longitude: point.lng })),
    [safePoints]
  );

  const region = useMemo(() => {
    if (coordinates.length === 0) {
      return {
        latitude: 44.4268,
        longitude: 26.1025,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    }
    const lats = coordinates.map((c) => c.latitude);
    const lngs = coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latitudeDelta = Math.max(0.01, (maxLat - minLat) * 1.6);
    const longitudeDelta = Math.max(0.01, (maxLng - minLng) * 1.6);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta,
      longitudeDelta,
    };
  }, [coordinates]);

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
      >
        {coordinates.length > 1 && (
          <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={3} />
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
});
import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Colors } from "../theme/colors";

function boundsFromCoords(coords: { latitude: number; longitude: number }[]) {
  let minLat = coords[0]?.latitude ?? 0;
  let maxLat = coords[0]?.latitude ?? 0;
  let minLng = coords[0]?.longitude ?? 0;
  let maxLng = coords[0]?.longitude ?? 0;

  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }

  return { minLat, maxLat, minLng, maxLng };
}

export function RouteMiniMap({
  polyline,
}: {
  polyline: number[][]; // [lat,lng]
}) {
  const coords = useMemo(() => {
    return (polyline || [])
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map((p) => ({ latitude: p[0], longitude: p[1] }));
  }, [polyline]);

  const region = useMemo(() => {
    if (!coords.length) {
      return {
        latitude: 45.9432,
        longitude: 24.9668,
        latitudeDelta: 6,
        longitudeDelta: 6,
      };
    }

    const b = boundsFromCoords(coords);
    const lat = (b.minLat + b.maxLat) / 2;
    const lng = (b.minLng + b.maxLng) / 2;

    const latDelta = Math.max(0.01, (b.maxLat - b.minLat) * 1.8);
    const lngDelta = Math.max(0.01, (b.maxLng - b.minLng) * 1.8);

    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [coords]);

  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsScale={false}
      >
        {coords.length > 0 ? (
          <>
            {start ? <Marker coordinate={start} pinColor={Colors.accent} /> : null}
            {end ? <Marker coordinate={end} pinColor={Colors.muted} /> : null}
            <Polyline
              coordinates={coords}
              strokeWidth={3}
              strokeColor={Colors.accent}
            />
          </>
        ) : null}
      </MapView>
      <View pointerEvents="none" style={styles.overlayBorder} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.card2,
  },
  overlayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
});

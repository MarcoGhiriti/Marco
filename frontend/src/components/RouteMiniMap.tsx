import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Polyline as SvgPolyline, Circle } from "react-native-svg";
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

function normalizeToSvg(
  coords: { latitude: number; longitude: number }[],
  width: number,
  height: number
) {
  if (!coords.length) return { points: "", start: null, end: null };

  const b = boundsFromCoords(coords);
  const pad = 6;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);

  const lngSpan = Math.max(0.00001, b.maxLng - b.minLng);
  const latSpan = Math.max(0.00001, b.maxLat - b.minLat);

  const pts = coords
    .map((c) => {
      const x = pad + ((c.longitude - b.minLng) / lngSpan) * w;
      // invert y (lat bigger = up)
      const y = pad + (1 - (c.latitude - b.minLat) / latSpan) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const start = coords[0];
  const end = coords[coords.length - 1];

  const startX = pad + ((start.longitude - b.minLng) / lngSpan) * w;
  const startY = pad + (1 - (start.latitude - b.minLat) / latSpan) * h;
  const endX = pad + ((end.longitude - b.minLng) / lngSpan) * w;
  const endY = pad + (1 - (end.latitude - b.minLat) / latSpan) * h;

  return {
    points: pts,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
  };
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

  // Native MapView is used on iOS/Android. Web uses SVG fallback.

  const width = 420;
  const height = 150;
  const svg = useMemo(() => normalizeToSvg(coords, width, height), [coords]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <Svg width={width} height={height}>
          <SvgPolyline
            points={svg.points}
            fill="none"
            stroke={Colors.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {svg.start ? (
            <Circle cx={svg.start.x} cy={svg.start.y} r={5} fill={Colors.accent} />
          ) : null}
          {svg.end ? (
            <Circle cx={svg.end.x} cy={svg.end.y} r={5} fill={Colors.muted} />
          ) : null}
        </Svg>
        <View pointerEvents="none" style={styles.overlayBorder} />
      </View>
    );
  }

  // For native platforms, we'll use a placeholder for now to avoid import issues
  return (
    <View style={styles.wrap}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center' }]}>
        <Svg width={width} height={height}>
          <SvgPolyline
            points={svg.points}
            fill="none"
            stroke={Colors.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {svg.start ? (
            <Circle cx={svg.start.x} cy={svg.start.y} r={5} fill={Colors.accent} />
          ) : null}
          {svg.end ? (
            <Circle cx={svg.end.x} cy={svg.end.y} r={5} fill={Colors.muted} />
          ) : null}
        </Svg>
      </View>
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

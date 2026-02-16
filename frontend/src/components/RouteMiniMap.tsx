import React, { useMemo } from "react";
import { Platform, StyleSheet, View, Text } from "react-native";
import Svg, { Polyline as SvgPolyline, Circle, Rect } from "react-native-svg";
import { softShadow } from "../theme/shadow";
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
  const pad = 20; // Increased padding for labels
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


type RouteMiniMapProps = {
  polyline: number[][]; // [lat,lng]
  startCity?: string;
  endCity?: string;
};

export function RouteMiniMap({
  polyline,
  startCity,
  endCity,
}: RouteMiniMapProps) {
  const coords = useMemo(() => {
    return (polyline || [])
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map((p) => ({ latitude: p[0], longitude: p[1] }));
  }, [polyline]);

  const width = 420;
  const height = 150;
  const svg = useMemo(() => normalizeToSvg(coords, width, height), [coords]);
  const renderMap = () => (
    <View style={styles.mapContainer}>
      <Svg width={width} height={height}>
        {/* Main route polyline */}
        <SvgPolyline
          points={svg.points}
          fill="none"
          stroke={Colors.accent}
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        
        {/* Start point marker */}
        {svg.start && (
          <>
            <Circle cx={svg.start.x} cy={svg.start.y} r={8} fill={Colors.success} />
            <Circle cx={svg.start.x} cy={svg.start.y} r={4} fill="#FFF" />
          </>
        )}
        
        {/* End point marker */}
        {svg.end && (
          <>
            <Circle cx={svg.end.x} cy={svg.end.y} r={8} fill={Colors.danger} />
            <Circle cx={svg.end.x} cy={svg.end.y} r={4} fill="#FFF" />
          </>
        )}
      </Svg>
      
      {/* City labels */}
      {startCity && svg.start && (
        <View style={[styles.cityLabel, styles.startLabel, { 
          left: Math.max(4, Math.min(svg.start.x - 30, width - 70)),
          top: svg.start.y > height / 2 ? svg.start.y - 28 : svg.start.y + 12 
        }]}>
          <Text style={styles.cityLabelText} numberOfLines={1}>{startCity}</Text>
        </View>
      )}
      
      {endCity && svg.end && (
        <View style={[styles.cityLabel, styles.endLabel, { 
          left: Math.max(4, Math.min(svg.end.x - 30, width - 70)),
          top: svg.end.y > height / 2 ? svg.end.y - 28 : svg.end.y + 12 
        }]}>
          <Text style={styles.cityLabelText} numberOfLines={1}>{endCity}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {renderMap()}
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
    ...softShadow(10, "#000", 0.55),
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  overlayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  cityLabel: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 80,
  },
  startLabel: {
    backgroundColor: Colors.success + "DD",
  },
  endLabel: {
    backgroundColor: Colors.danger + "DD",
  },
  cityLabelText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
});

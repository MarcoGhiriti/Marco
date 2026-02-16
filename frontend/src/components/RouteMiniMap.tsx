import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Colors } from "../theme/colors";
import { API_BASE_URL } from "../lib/api";

/* ---------- Google Polyline Encoder ---------- */
function encodeValue(v: number): string {
  let val = v < 0 ? ~(v << 1) : v << 1;
  let out = "";
  while (val >= 0x20) {
    out += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
    val >>= 5;
  }
  out += String.fromCharCode(val + 63);
  return out;
}

function encodePolyline(coords: number[][]): string {
  let prevLat = 0;
  let prevLng = 0;
  let encoded = "";
  for (const [lat, lng] of coords) {
    const latR = Math.round(lat * 1e5);
    const lngR = Math.round(lng * 1e5);
    encoded += encodeValue(latR - prevLat);
    encoded += encodeValue(lngR - prevLng);
    prevLat = latR;
    prevLng = lngR;
  }
  return encoded;
}

/* ---------- Build URL via backend proxy ---------- */
function buildRouteUrl(polyline: number[][]): string {
  if (!polyline || polyline.length < 2) return "";
  const enc = encodePolyline(polyline);
  const start = polyline[0];
  const end = polyline[polyline.length - 1];
  const params = new URLSearchParams({
    polyline_str: enc,
    start_lat: String(start[0]),
    start_lng: String(start[1]),
    end_lat: String(end[0]),
    end_lng: String(end[1]),
  });
  return `${API_BASE_URL}/api/map/static-image?${params.toString()}`;
}

function buildPointUrl(lat: number, lng: number, zoom = 14): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    zoom: String(zoom),
  });
  return `${API_BASE_URL}/api/map/static-image?${params.toString()}`;
}

/* ---------- Component ---------- */
type Props = {
  polyline?: number[][];
  lat?: number;
  lng?: number;
  zoom?: number;
  startCity?: string;
  endCity?: string;
  locationName?: string;
  height?: number;
};

export function RouteMiniMap({
  polyline,
  lat,
  lng,
  zoom = 14,
  startCity,
  endCity,
  locationName,
  height = 150,
}: Props) {
  const url = useMemo(() => {
    if (polyline && polyline.length >= 2) return buildRouteUrl(polyline);
    if (lat != null && lng != null) return buildPointUrl(lat, lng, zoom);
    return "";
  }, [polyline, lat, lng, zoom]);

  if (!url) {
    return (
      <View style={[styles.wrap, styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>No preview</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />

      {startCity ? (
        <View style={[styles.cityTag, styles.startTag]}>
          <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
          <Text style={styles.cityText} numberOfLines={1}>{startCity}</Text>
        </View>
      ) : null}

      {endCity ? (
        <View style={[styles.cityTag, styles.endTag]}>
          <View style={[styles.dot, { backgroundColor: "#FF3B30" }]} />
          <Text style={styles.cityText} numberOfLines={1}>{endCity}</Text>
        </View>
      ) : null}

      {locationName && !startCity ? (
        <View style={[styles.cityTag, styles.startTag, { maxWidth: 200 }]}>
          <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
          <Text style={styles.cityText} numberOfLines={1}>{locationName}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cityTag: {
    position: "absolute",
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(10,15,14,0.85)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxWidth: 120,
  },
  startTag: { left: 8 },
  endTag: { right: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  cityText: { color: Colors.text, fontSize: 10, fontFamily: "Inter_600SemiBold" },
});

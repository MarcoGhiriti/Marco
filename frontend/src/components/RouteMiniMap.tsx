import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Colors } from "../theme/colors";

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";

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

/* ---------- Dark style params for Static Maps ---------- */
const STYLE_PARAMS = [
  "style=element:geometry%7Ccolor:0x101615",
  "style=element:labels.text.fill%7Ccolor:0x8da39c",
  "style=element:labels.text.stroke%7Ccolor:0x101615",
  "style=feature:road%7Celement:geometry%7Ccolor:0x242d2b",
  "style=feature:road%7Celement:geometry.stroke%7Ccolor:0x141b19",
  "style=feature:road.highway%7Celement:geometry%7Ccolor:0x303b38",
  "style=feature:road.highway%7Celement:geometry.stroke%7Ccolor:0x394543",
  "style=feature:water%7Celement:geometry%7Ccolor:0x0f1b18",
  "style=feature:landscape%7Celement:geometry%7Ccolor:0x0f1413",
  "style=feature:poi%7Cvisibility:off",
  "style=feature:transit%7Cvisibility:off",
].join("&");

/* ---------- Build URL ---------- */
function buildStaticUrl(polyline: number[][]): string {
  if (!polyline || polyline.length < 2 || !MAPS_KEY) return "";

  const enc = encodePolyline(polyline);
  const start = polyline[0];
  const end = polyline[polyline.length - 1];

  const parts = [
    "https://maps.googleapis.com/maps/api/staticmap?",
    "size=640x220",
    "&scale=2",
    "&maptype=roadmap",
    `&${STYLE_PARAMS}`,
    `&path=color:0x36F19AFF%7Cweight:4%7Cenc:${encodeURIComponent(enc)}`,
    `&markers=size:small%7Ccolor:0x36F19A%7C${start[0]},${start[1]}`,
    `&markers=size:small%7Ccolor:0xFF3B30%7C${end[0]},${end[1]}`,
    `&key=${MAPS_KEY}`,
  ];

  return parts.join("");
}

/* ---------- Component ---------- */
type Props = {
  polyline: number[][];
  startCity?: string;
  endCity?: string;
};

export function RouteMiniMap({ polyline, startCity, endCity }: Props) {
  const url = useMemo(() => buildStaticUrl(polyline || []), [polyline]);

  if (!url) {
    return (
      <View style={[styles.wrap, styles.placeholder]}>
        <Text style={styles.placeholderText}>No preview</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />

      {/* City labels overlay */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cityText: {
    color: Colors.text,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});

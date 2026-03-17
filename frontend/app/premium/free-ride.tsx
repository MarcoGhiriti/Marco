import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, API_BASE_URL } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type FreeRideState = {
  id: string;
  status: "active" | "paused";
  started_at: string;
};

type RideSummary = {
  distance_km: number;
  max_speed_kmh: number;
  duration_seconds: number;
  stops_count: number;
  polyline: number[][];
  stop_checkpoints: number[][];
};

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
  let prevLat = 0, prevLng = 0, encoded = "";
  for (const [lat, lng] of coords) {
    const latR = Math.round(lat * 1e5), lngR = Math.round(lng * 1e5);
    encoded += encodeValue(latR - prevLat);
    encoded += encodeValue(lngR - prevLng);
    prevLat = latR;
    prevLng = lngR;
  }
  return encoded;
}

function buildLiveMapUrl(lat: number, lng: number, polyline: number[][]): string {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), zoom: "15" });
  if (polyline.length >= 2) {
    params.set("polyline_str", encodePolyline(polyline));
    params.set("start_lat", String(polyline[0][0]));
    params.set("start_lng", String(polyline[0][1]));
    params.set("end_lat", String(lat));
    params.set("end_lng", String(lng));
  }
  return `${API_BASE_URL}/api/map/static-image?${params.toString()}`;
}

function buildSummaryMapUrl(polyline: number[][], stops: number[][]): string {
  if (polyline.length < 2) return "";
  const enc = encodePolyline(polyline);
  const start = polyline[0], end = polyline[polyline.length - 1];
  let url = `${API_BASE_URL}/api/map/static-image?polyline_str=${encodeURIComponent(enc)}&start_lat=${start[0]}&start_lng=${start[1]}&end_lat=${end[0]}&end_lng=${end[1]}`;
  if (stops.length > 0) {
    const stopMarkers = stops.map(s => `${s[0]},${s[1]}`).join("|");
    url += `&stop_markers=${encodeURIComponent(stopMarkers)}`;
  }
  return url;
}

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

export default function FreeRideScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [ride, setRide] = useState<FreeRideState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [summary, setSummary] = useState<RideSummary | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [polyline, setPolyline] = useState<number[][]>([]);
  const [stops, setStops] = useState(0);
  const [stopCheckpoints, setStopCheckpoints] = useState<number[][]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<Date | null>(null);
  const pausedElapsed = useRef(0);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Check for active ride
  useEffect(() => {
    if (!headers) return;
    apiGet<{ active: boolean; id?: string; status?: string; started_at?: string }>(
      "/api/premium/free-ride/active", headers,
    ).then((data) => {
      if (data.active && data.id) {
        setRide({ id: data.id, status: data.status as any, started_at: data.started_at! });
        startTime.current = new Date(data.started_at!);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [headers]);

  // Timer
  useEffect(() => {
    if (ride?.status === "active") {
      timerRef.current = setInterval(() => {
        if (startTime.current) {
          setElapsed(pausedElapsed.current + Math.floor((Date.now() - startTime.current.getTime()) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ride?.status]);

  // Refresh map image every 10s during active ride
  useEffect(() => {
    if (ride?.status === "active" && currentPos) {
      mapRefreshRef.current = setInterval(() => setMapKey(k => k + 1), 10000);
    } else {
      if (mapRefreshRef.current) clearInterval(mapRefreshRef.current);
    }
    return () => { if (mapRefreshRef.current) clearInterval(mapRefreshRef.current); };
  }, [ride?.status, currentPos]);

  // Location tracking
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let watchId: number | null = null;

    const onLocation = (lat: number, lng: number, spd: number) => {
      const spdKmh = Math.max(0, spd * 3.6);
      setSpeed(spdKmh);
      setMaxSpeed(prev => Math.max(prev, spdKmh));
      setCurrentPos({ lat, lng });
      if (lastPos.current && ride?.status === "active") {
        const d = haversine(lastPos.current.lat, lastPos.current.lng, lat, lng);
        if (d > 0.005) { // minimum 5m to avoid GPS jitter
          setDistance(prev => prev + d);
          setPolyline(prev => [...prev, [lat, lng]]);
        }
      } else if (!lastPos.current) {
        setPolyline(prev => prev.length === 0 ? [[lat, lng]] : prev);
      }
      lastPos.current = { lat, lng };
    };

    if (ride) {
      (async () => {
        if (Platform.OS === "web") {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => onLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.speed || 0),
              () => {}, { enableHighAccuracy: true }
            );
            watchId = navigator.geolocation.watchPosition(
              pos => onLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.speed || 0),
              () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
            );
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            onLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.speed || 0);
            sub = await Location.watchPositionAsync(
              { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10, timeInterval: 3000 },
              loc => onLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.speed || 0),
            );
          }
        }
      })();
    }

    return () => {
      sub?.remove();
      if (watchId !== null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(watchId);
    };
  }, [ride?.id, ride?.status]);

  const handleStart = async () => {
    if (!headers) return;
    setActionLoading(true);
    try {
      const data = await apiPost<{ id: string; status: string; started_at: string }>(
        "/api/premium/free-ride/start", {}, headers);
      setRide({ id: data.id, status: "active", started_at: data.started_at });
      startTime.current = new Date(data.started_at);
      pausedElapsed.current = 0;
      setElapsed(0); setDistance(0); setSpeed(0); setMaxSpeed(0);
      setPolyline([]); setStops(0); setStopCheckpoints([]); setSummary(null);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handlePause = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/pause`, {}, headers);
      pausedElapsed.current = elapsed;
      setRide({ ...ride, status: "paused" });
      setStops(p => p + 1);
      if (currentPos) {
        setStopCheckpoints(prev => [...prev, [currentPos.lat, currentPos.lng]]);
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/resume`, {}, headers);
      startTime.current = new Date();
      setRide({ ...ride, status: "active" });
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleEnd = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/end`, {
        polyline, distance_km: distance, max_speed_kmh: maxSpeed,
        duration_seconds: elapsed, stops_count: stops,
      }, headers);
      setSummary({
        distance_km: distance, max_speed_kmh: maxSpeed,
        duration_seconds: elapsed, stops_count: stops,
        polyline, stop_checkpoints: stopCheckpoints,
      });
      setRide(null);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      </SafeAreaView>
    );
  }

  // ========================
  // SUMMARY VIEW (after ride ends)
  // ========================
  if (summary) {
    const mapUrl = summary.polyline.length >= 2
      ? buildSummaryMapUrl(summary.polyline, summary.stop_checkpoints)
      : "";

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => { setSummary(null); router.back(); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Ride Summary</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.summaryContent}>
          {mapUrl ? (
            <View style={styles.summaryMapWrap} data-testid="ride-summary-map">
              <Image source={{ uri: mapUrl }} style={styles.summaryMapImg} resizeMode="cover" />
              {summary.stop_checkpoints.length > 0 && (
                <View style={styles.summaryMapLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
                    <Text style={styles.legendText}>Route</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
                    <Text style={styles.legendText}>{summary.stops_count} stops</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noMapCard}>
              <Ionicons name="map-outline" size={48} color={Colors.muted} />
              <Text style={styles.noMapText}>No route data recorded</Text>
            </View>
          )}

          <View style={styles.summaryStatsGrid}>
            <View style={styles.summaryStatCard}>
              <Ionicons name="navigate" size={22} color={Colors.accent} />
              <Text style={styles.summaryStatValue}>{summary.distance_km.toFixed(1)}</Text>
              <Text style={styles.summaryStatUnit}>km</Text>
              <Text style={styles.summaryStatLabel}>Distance</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Ionicons name="flash" size={22} color={Colors.warning} />
              <Text style={styles.summaryStatValue}>{summary.max_speed_kmh.toFixed(0)}</Text>
              <Text style={styles.summaryStatUnit}>km/h</Text>
              <Text style={styles.summaryStatLabel}>Max Speed</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Ionicons name="time" size={22} color={Colors.accent} />
              <Text style={styles.summaryStatValue}>{formatTime(summary.duration_seconds)}</Text>
              <Text style={styles.summaryStatUnit}></Text>
              <Text style={styles.summaryStatLabel}>Duration</Text>
            </View>
          </View>

          {summary.stops_count > 0 && (
            <View style={styles.stopsCard}>
              <Ionicons name="pause-circle" size={20} color={Colors.danger} />
              <Text style={styles.stopsText}>{summary.stops_count} stop{summary.stops_count > 1 ? "s" : ""} during ride</Text>
            </View>
          )}

          <Pressable style={styles.doneBtn} onPress={() => { setSummary(null); router.back(); }} data-testid="ride-summary-done-btn">
            <Ionicons name="checkmark-circle" size={20} color={Colors.bg} />
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========================
  // START SCREEN
  // ========================
  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Free Ride</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.startContainer}>
          <Ionicons name="speedometer" size={64} color={Colors.accent} />
          <Text style={styles.startTitle}>Free Ride Mode</Text>
          <Text style={styles.startDesc}>
            Track your ride with live GPS. Speed, distance, time, and your route on the map - all recorded in real time.
          </Text>
          <Pressable style={styles.startBtn} onPress={handleStart} disabled={actionLoading} data-testid="start-free-ride-btn">
            {actionLoading ? <ActivityIndicator color={Colors.bg} /> : (
              <><Ionicons name="play" size={24} color={Colors.bg} /><Text style={styles.startBtnText}>Start Ride</Text></>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ========================
  // ACTIVE RIDE VIEW (with live map)
  // ========================
  const liveMapUrl = currentPos
    ? buildLiveMapUrl(currentPos.lat, currentPos.lng, polyline)
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Live Map */}
      <View style={styles.liveMapContainer}>
        {liveMapUrl ? (
          <Image
            key={`map-${mapKey}`}
            source={{ uri: liveMapUrl }}
            style={styles.liveMapImg}
            resizeMode="cover"
            data-testid="live-ride-map"
          />
        ) : (
          <View style={styles.liveMapPlaceholder}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.liveMapPlaceholderText}>Getting GPS location...</Text>
          </View>
        )}
        {/* Status Badge overlay */}
        <View style={[styles.statusBadge, ride.status === "paused" && styles.statusPaused]}>
          <Ionicons name={ride.status === "active" ? "radio-button-on" : "pause"} size={12} color="#fff" />
          <Text style={styles.statusText}>{ride.status === "active" ? "LIVE" : "PAUSED"}</Text>
        </View>
      </View>

      {/* Live Stats Panel */}
      <View style={styles.liveStatsPanel} data-testid="live-stats-panel">
        {/* Timer */}
        <Text style={styles.liveTimer} data-testid="ride-timer">{formatTime(elapsed)}</Text>

        {/* Stats Row */}
        <View style={styles.liveStatsRow}>
          <View style={styles.liveStatItem}>
            <Text style={styles.liveStatValue} data-testid="ride-speed">{speed.toFixed(0)}</Text>
            <Text style={styles.liveStatLabel}>km/h</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatItem}>
            <Text style={styles.liveStatValue} data-testid="ride-distance">{distance.toFixed(1)}</Text>
            <Text style={styles.liveStatLabel}>km</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatItem}>
            <Text style={styles.liveStatValue} data-testid="ride-max-speed">{maxSpeed.toFixed(0)}</Text>
            <Text style={styles.liveStatLabel}>max km/h</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {ride.status === "active" ? (
            <Pressable style={styles.pauseBtn} onPress={handlePause} disabled={actionLoading} data-testid="pause-free-ride-btn">
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <><Ionicons name="pause" size={22} color="#fff" /><Text style={styles.controlText}>Pause</Text></>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.resumeBtn} onPress={handleResume} disabled={actionLoading} data-testid="resume-free-ride-btn">
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <><Ionicons name="play" size={22} color="#fff" /><Text style={styles.controlText}>Resume</Text></>
              )}
            </Pressable>
          )}
          <Pressable style={styles.stopBtn} onPress={handleEnd} disabled={actionLoading} data-testid="stop-free-ride-btn">
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <><Ionicons name="stop" size={22} color="#fff" /><Text style={styles.controlText}>Stop</Text></>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },

  // Start screen
  startContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 },
  startTitle: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  startDesc: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 22, maxWidth: 300 },
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 40, marginTop: 12,
  },
  startBtnText: { color: Colors.bg, fontSize: 18, fontFamily: "Inter_900Black" },

  // Live Map
  liveMapContainer: { flex: 1, backgroundColor: Colors.card2, position: "relative" },
  liveMapImg: { width: "100%", height: "100%" },
  liveMapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  liveMapPlaceholderText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusBadge: {
    position: "absolute", top: 16, left: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.success, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  statusPaused: { backgroundColor: Colors.warning },
  statusText: { color: "#fff", fontSize: 12, fontFamily: "Inter_900Black" },

  // Live Stats Panel
  liveStatsPanel: {
    backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 36 : 20, gap: 14,
  },
  liveTimer: { color: Colors.text, fontSize: 40, fontFamily: "Inter_900Black", textAlign: "center" },
  liveStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  liveStatItem: { flex: 1, alignItems: "center", gap: 2 },
  liveStatValue: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  liveStatLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  liveStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // Controls
  controls: { flexDirection: "row", gap: 12 },
  pauseBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.warning, borderRadius: 14, paddingVertical: 16,
  },
  resumeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.success, borderRadius: 14, paddingVertical: 16,
  },
  stopBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.danger, borderRadius: 14, paddingVertical: 16,
  },
  controlText: { color: "#fff", fontSize: 15, fontFamily: "Inter_900Black" },

  // Summary
  summaryContent: { padding: 16, gap: 16, paddingBottom: 40 },
  summaryMapWrap: {
    borderRadius: 18, overflow: "hidden", backgroundColor: Colors.card2,
    borderWidth: 1, borderColor: Colors.border, position: "relative",
  },
  summaryMapImg: { width: "100%", height: 240 },
  summaryMapLegend: {
    position: "absolute", bottom: 10, left: 10,
    flexDirection: "row", gap: 14,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: Colors.text, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  noMapCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 40, alignItems: "center", gap: 10,
  },
  noMapText: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summaryStatsGrid: { flexDirection: "row", gap: 10 },
  summaryStatCard: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, alignItems: "center", gap: 4,
  },
  summaryStatValue: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  summaryStatUnit: { color: Colors.accent, fontSize: 11, fontFamily: "Inter_700Bold" },
  summaryStatLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stopsCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.danger}44`,
    borderRadius: 14, padding: 14,
  },
  stopsText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  doneBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16,
  },
  doneBtnText: { color: Colors.bg, fontSize: 16, fontFamily: "Inter_900Black" },
});

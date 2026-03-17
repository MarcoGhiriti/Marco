import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type FreeRideState = {
  id: string;
  status: "active" | "paused";
  started_at: string;
};

export default function FreeRideScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [ride, setRide] = useState<FreeRideState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Ride stats
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [polyline, setPolyline] = useState<number[][]>([]);
  const [stops, setStops] = useState(0);

  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<Date | null>(null);
  const pausedElapsed = useRef(0);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Check for active ride on mount
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
          const now = new Date();
          setElapsed(pausedElapsed.current + Math.floor((now.getTime() - startTime.current.getTime()) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ride?.status]);

  // Location tracking
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let watchId: number | null = null;

    const onLocation = (lat: number, lng: number, spd: number) => {
      setSpeed(Math.max(0, spd * 3.6)); // m/s -> km/h
      setMaxSpeed((prev) => Math.max(prev, spd * 3.6));
      if (lastPos.current && ride?.status === "active") {
        const d = haversine(lastPos.current.lat, lastPos.current.lng, lat, lng);
        setDistance((prev) => prev + d);
        setPolyline((prev) => [...prev, [lat, lng]]);
      }
      lastPos.current = { lat, lng };
    };

    if (ride?.status === "active") {
      (async () => {
        if (Platform.OS === "web") {
          if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
              (pos) => onLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.speed || 0),
              () => {},
              { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
            );
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            sub = await Location.watchPositionAsync(
              { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10, timeInterval: 3000 },
              (loc) => onLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.speed || 0),
            );
          }
        }
      })();
    }

    return () => {
      sub?.remove();
      if (watchId !== null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(watchId);
    };
  }, [ride?.status]);

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleStart = async () => {
    if (!headers) return;
    setActionLoading(true);
    try {
      const data = await apiPost<{ id: string; status: string; started_at: string }>(
        "/api/premium/free-ride/start", {}, headers,
      );
      setRide({ id: data.id, status: "active", started_at: data.started_at });
      startTime.current = new Date(data.started_at);
      pausedElapsed.current = 0;
      setElapsed(0);
      setDistance(0);
      setSpeed(0);
      setMaxSpeed(0);
      setPolyline([]);
      setStops(0);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/pause`, {}, headers);
      pausedElapsed.current = elapsed;
      setRide({ ...ride, status: "paused" });
      setStops((p) => p + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/resume`, {}, headers);
      startTime.current = new Date();
      setRide({ ...ride, status: "active" });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!headers || !ride) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/premium/free-ride/${ride.id}/end`, {
        polyline,
        distance_km: distance,
        max_speed_kmh: maxSpeed,
        duration_seconds: elapsed,
        stops_count: stops,
      }, headers);
      // Navigate to summary (handled by showing ended state)
      setRide(null);
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      </SafeAreaView>
    );
  }

  // Not started yet
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
            Track your ride without a predefined route. Speed, distance, and time will be recorded.
          </Text>
          <Pressable
            style={styles.startBtn}
            onPress={handleStart}
            disabled={actionLoading}
            data-testid="start-free-ride-btn"
          >
            {actionLoading ? <ActivityIndicator color={Colors.bg} /> : (
              <>
                <Ionicons name="play" size={24} color={Colors.bg} />
                <Text style={styles.startBtnText}>Start Ride</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Active ride view
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.rideContainer}>
        {/* Status indicator */}
        <View style={[styles.statusBadge, ride.status === "paused" && styles.statusPaused]}>
          <Ionicons name={ride.status === "active" ? "radio-button-on" : "pause"} size={14} color="#fff" />
          <Text style={styles.statusText}>{ride.status === "active" ? "RIDING" : "PAUSED"}</Text>
        </View>

        {/* Timer */}
        <Text style={styles.timerText} data-testid="ride-timer">{formatTime(elapsed)}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue} data-testid="ride-speed">{speed.toFixed(0)}</Text>
            <Text style={styles.statUnit}>km/h</Text>
            <Text style={styles.statLabel}>Speed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} data-testid="ride-distance">{distance.toFixed(1)}</Text>
            <Text style={styles.statUnit}>km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} data-testid="ride-max-speed">{maxSpeed.toFixed(0)}</Text>
            <Text style={styles.statUnit}>km/h</Text>
            <Text style={styles.statLabel}>Max Speed</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {ride.status === "active" ? (
            <Pressable style={styles.pauseBtn} onPress={handlePause} disabled={actionLoading} data-testid="pause-free-ride-btn">
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="pause" size={24} color="#fff" />
                  <Text style={styles.controlText}>Pause</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.resumeBtn} onPress={handleResume} disabled={actionLoading} data-testid="resume-free-ride-btn">
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="play" size={24} color="#fff" />
                  <Text style={styles.controlText}>Resume</Text>
                </>
              )}
            </Pressable>
          )}
          <Pressable style={styles.stopBtn} onPress={handleEnd} disabled={actionLoading} data-testid="stop-free-ride-btn">
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="stop" size={24} color="#fff" />
                <Text style={styles.controlText}>Stop</Text>
              </>
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

  startContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, gap: 20,
  },
  startTitle: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  startDesc: {
    color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold",
    textAlign: "center", lineHeight: 22, maxWidth: 300,
  },
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: Colors.accent, borderRadius: 20,
    paddingVertical: 18, paddingHorizontal: 40, marginTop: 12,
  },
  startBtnText: { color: Colors.bg, fontSize: 18, fontFamily: "Inter_900Black" },

  rideContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 28,
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.success, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  statusPaused: { backgroundColor: Colors.warning },
  statusText: { color: "#fff", fontSize: 13, fontFamily: "Inter_900Black" },

  timerText: { color: Colors.text, fontSize: 56, fontFamily: "Inter_900Black" },

  statsGrid: { flexDirection: "row", gap: 16, width: "100%" },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 18, alignItems: "center", gap: 4,
  },
  statValue: { color: Colors.text, fontSize: 28, fontFamily: "Inter_900Black" },
  statUnit: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_700Bold" },
  statLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },

  controls: { flexDirection: "row", gap: 16, width: "100%" },
  pauseBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.warning, borderRadius: 16, paddingVertical: 18,
  },
  resumeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.success, borderRadius: 16, paddingVertical: 18,
  },
  stopBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.danger, borderRadius: 16, paddingVertical: 18,
  },
  controlText: { color: "#fff", fontSize: 16, fontFamily: "Inter_900Black" },
});

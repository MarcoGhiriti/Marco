import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type EventMarker = {
  id: string;
  title: string;
  start_point: number[];
  start_time: string;
  location_name?: string;
};

const DEFAULT_REGION = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export default function MapScreen() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<EventMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadEvents = useCallback(async () => {
    if (!authHeader) return;
    try {
      setLoading(true);
      const data = await apiGet<EventMarker[]>("/api/events", authHeader);
      const now = new Date();
      const upcoming = (data || []).filter((e) => new Date(e.start_time) >= now);
      setEvents(upcoming);
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const initialRegion = useMemo(() => {
    if (events.length > 0) {
      const [lat, lng] = events[0].start_point || [];
      if (typeof lat === "number" && typeof lng === "number") {
        return {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        };
      }
    }
    return DEFAULT_REGION;
  }, [events]);

  const handleReportPolice = () => {
    Alert.alert("Report Police", "This feature is available on the live mobile map.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Live Map</Text>
            <Text style={styles.sub}>Event markers & police reports</Text>
          </View>
        </View>
        <View style={styles.mapWrapper}>
          <MapView style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
            {showEvents &&
              events.map((event) => {
                const [lat, lng] = event.start_point || [];
                if (typeof lat !== "number" || typeof lng !== "number") return null;
                return (
                  <Marker
                    key={event.id}
                    coordinate={{ latitude: lat, longitude: lng }}
                    title={event.title}
                    description={event.location_name}
                  />
                );
              })}
          </MapView>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          )}

          {!loading && showEvents && events.length === 0 && (
            <View style={styles.emptyEvents}>
              <Ionicons name="calendar" size={20} color={Colors.muted} />
              <Text style={styles.emptyText}>No upcoming events</Text>
            </View>
          )}

          <View style={styles.toggleBar}>
            <View style={styles.toggleRow}>
              <Ionicons name="calendar" size={16} color={Colors.text} />
              <Text style={styles.toggleText}>Show Events</Text>
            </View>
            <Switch
              value={showEvents}
              onValueChange={setShowEvents}
              thumbColor={showEvents ? Colors.accent : Colors.muted}
              trackColor={{ false: Colors.card2, true: Colors.accent2 }}
            />
          </View>

          <Pressable style={styles.reportFab} onPress={handleReportPolice}>
            <Ionicons name="shield" size={20} color={Colors.bg} />
            <Text style={styles.reportFabText}>Report Police</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mapWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,7,0.35)",
  },
  toggleBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reportFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reportFabText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyEvents: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

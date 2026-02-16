import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import MapCanvas from "../../src/components/MapCanvas";

type EventMarker = {
  id: string;
  title: string;
  start_point: number[];
  start_time: string;
  location_name?: string;
};

export default function MapScreen() {
  const router = useRouter();
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
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => router.push("/create/route")}
            >
              <Ionicons name="trail-sign" size={18} color={Colors.text} />
            </Pressable>
            <Pressable
              style={styles.headerBtn}
              onPress={() => router.push("/create/event")}
            >
              <Ionicons name="calendar" size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        <MapCanvas
          events={events}
          loading={loading}
          showEvents={showEvents}
          onToggleEvents={setShowEvents}
          onReportPolice={handleReportPolice}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

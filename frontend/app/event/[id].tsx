import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { EventOut } from "../../src/types/api";

// Haversine formula to calculate distance between two points
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [event, setEvent] = useState<EventOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [joining, setJoining] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadEvent = useCallback(async () => {
    if (!headers || !id) return;
    setLoading(true);
    setError(null);
    try {
      // Get all events and find the one we need
      const events = await apiGet<EventOut[]>("/api/events", headers);
      const found = events.find((e) => e.id === id);
      if (!found) {
        setError("Event not found");
      } else {
        setEvent(found);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [headers, id]);

  const loadLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    }
  }, []);

  useEffect(() => {
    loadEvent();
    loadLocation();
  }, [loadEvent, loadLocation]);

  const joinOrLeave = async () => {
    if (!headers || !event) return;
    setJoining(true);
    try {
      if (event.is_joined) {
        await apiPost(`/api/events/${event.id}/leave`, {}, headers);
      } else {
        await apiPost(`/api/events/${event.id}/join`, {}, headers);
      }
      await loadEvent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setJoining(false);
    }
  };

  const distance = useMemo(() => {
    if (!userLocation || !event) return null;
    return haversineKm(
      userLocation.lat,
      userLocation.lng,
      event.start_point[0],
      event.start_point[1]
    );
  }, [userLocation, event]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Event Details</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error || "Event not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map with meeting point */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: event.start_point[0],
              longitude: event.start_point[1],
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation
            customMapStyle={darkMapStyle}
          >
            <Marker
              coordinate={{
                latitude: event.start_point[0],
                longitude: event.start_point[1],
              }}
            >
              <View style={styles.meetingMarker}>
                <Ionicons name="flag" size={20} color="#FFF" />
              </View>
            </Marker>
          </MapView>

          {/* Distance Badge */}
          {distance !== null && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={16} color={Colors.accent} />
              <Text style={styles.distanceText}>
                {distance < 1
                  ? `${Math.round(distance * 1000)} m away`
                  : `${distance.toFixed(1)} km away`}
              </Text>
            </View>
          )}
        </View>

        {/* Event Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateBoxDay}>
                {new Date(event.start_time).getDate()}
              </Text>
              <Text style={styles.dateBoxMonth}>
                {new Date(event.start_time).toLocaleDateString("en-US", { month: "short" })}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.datetime}>{formatDate(event.start_time)}</Text>
            </View>
          </View>

          {event.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={18} color={Colors.accent} />
              <Text style={styles.statValue}>{event.participants_count}</Text>
              <Text style={styles.statLabel}>going</Text>
            </View>
            {distance !== null && (
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>
                  {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                </Text>
                <Text style={styles.statLabel}>from you</Text>
              </View>
            )}
          </View>
        </View>

        {/* Join Button */}
        <Pressable
          onPress={joinOrLeave}
          disabled={joining}
          style={[styles.joinButton, event.is_joined && styles.joinButtonJoined]}
        >
          {joining ? (
            <ActivityIndicator color={event.is_joined ? Colors.text : Colors.bg} />
          ) : (
            <>
              <Ionicons
                name={event.is_joined ? "checkmark-circle" : "add-circle"}
                size={22}
                color={event.is_joined ? Colors.text : Colors.bg}
              />
              <Text style={[styles.joinButtonText, event.is_joined && styles.joinButtonTextJoined]}>
                {event.is_joined ? "You're going!" : "Join Event"}
              </Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 20,
  },
  errorText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  content: { padding: 16, gap: 16 },
  mapContainer: {
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: { flex: 1 },
  meetingMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  distanceBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  distanceText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBoxDay: {
    color: Colors.accent,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  dateBoxMonth: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  datetime: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  descSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  description: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  joinButtonJoined: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  joinButtonText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  joinButtonTextJoined: {
    color: Colors.text,
  },
});

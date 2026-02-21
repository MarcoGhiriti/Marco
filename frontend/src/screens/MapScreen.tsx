import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import MapCanvas from "../components/MapCanvas";
import { apiGet, apiPost } from "../lib/api";
import { useAuthStore } from "../state/authStore";
import { Colors } from "../theme/colors";

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapEvent = {
  id: string;
  title: string;
  start_point: number[];
  location_name?: string;
};

type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  place_type: string;
};

type PoliceReport = {
  id: string;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
};

const DEFAULT_REGION: MapRegion = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const VOTE_DISTANCE_KM = 1;

const getBoundsFromRegion = (region: MapRegion) => {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    minLat: region.latitude - halfLat,
    maxLat: region.latitude + halfLat,
    minLng: region.longitude - halfLng,
    maxLng: region.longitude + halfLng,
  };
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const { accessToken } = useAuthStore();
  const mapRef = useRef<any>(null);
  const userPanning = useRef(false);

  const [region, setRegion] = useState<MapRegion>(DEFAULT_REGION);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showGas, setShowGas] = useState(false);
  const [showService, setShowService] = useState(false);
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [gasMarkers, setGasMarkers] = useState<MapPlace[]>([]);
  const [policeReports, setPoliceReports] = useState<PoliceReport[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const requestLocation = useCallback(async () => {
    if (isWeb) return null;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location required", "Please enable location permissions for the map.");
      return null;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setUserLocation(coords);
    return coords;
  }, []);

  const fetchMapData = useCallback(
    async (targetRegion: MapRegion) => {
      if (!authHeader) return;
      const bounds = getBoundsFromRegion(targetRegion);
      setIsFetching(true);
      try {
        const query = `?min_lat=${bounds.minLat}&max_lat=${bounds.maxLat}&min_lng=${bounds.minLng}&max_lng=${bounds.maxLng}`;
        const [eventsData, gasData, policeData] = await Promise.all([
          apiGet<MapEvent[]>(`/api/map/events${query}`, authHeader),
          (showGas || showService) ? apiGet<MapPlace[]>(`/api/map/gas-service${query}`, authHeader) : Promise.resolve([]),
          apiGet<PoliceReport[]>(`/api/map/police-reports${query}`, authHeader),
        ]);
        setEvents(eventsData || []);
        setGasMarkers(gasData || []);
        setPoliceReports(policeData || []);
      } catch (error) {
        console.error("Failed to fetch map data", error);
      } finally {
        setIsFetching(false);
      }
    },
    [authHeader, showGas, showService]
  );

  const initMap = useCallback(async () => {
    const location = await requestLocation();
    const nextRegion = location
      ? {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18,
        }
      : DEFAULT_REGION;
    setRegion(nextRegion);
    mapRef.current?.animateToRegion?.(nextRegion, 400);
    await fetchMapData(nextRegion);
  }, [fetchMapData, requestLocation]);

  useEffect(() => {
    if (authHeader && !isWeb) {
      initMap();
    }
  }, [authHeader, initMap, isWeb]);

  useFocusEffect(
    useCallback(() => {
      if (!isWeb) {
        fetchMapData(region);
      }
    }, [fetchMapData, region, isWeb])
  );

  const handleRecenter = useCallback(async () => {
    if (isWeb) return;
    const location = userLocation ?? (await requestLocation());
    if (!location) return;
    const nextRegion = {
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: 0.18,
      longitudeDelta: 0.18,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion?.(nextRegion, 400);
    setShowSearchArea(false);
    await fetchMapData(nextRegion);
  }, [fetchMapData, requestLocation, userLocation]);

  const handlePanDrag = () => {
    userPanning.current = true;
  };

  const handleRegionChangeComplete = (nextRegion: MapRegion) => {
    setRegion(nextRegion);
    if (userPanning.current) {
      setShowSearchArea(true);
      userPanning.current = false;
    }
  };

  const handleSearchArea = async () => {
    if (isWeb) return;
    await fetchMapData(region);
    setShowSearchArea(false);
  };

  const handleReportPolice = () => {
    setReportModalVisible(true);
  };

  const handleConfirmReport = async () => {
    if (!authHeader) return;
    const center = { lat: region.latitude, lng: region.longitude };
    setCreatingReport(true);
    try {
      const created = await apiPost<PoliceReport>(
        "/api/map/police-reports",
        { lat: center.lat, lng: center.lng },
        authHeader
      );
      setPoliceReports((prev) => [created, ...prev]);
    } catch (error) {
      Alert.alert("Error", "Unable to add report.");
    } finally {
      setCreatingReport(false);
      setReportModalVisible(false);
    }
  };

  const handleVotePolice = async (reportId: string, vote: "up" | "down", lat: number, lng: number) => {
    if (!authHeader) return;
    const location = userLocation ?? (await requestLocation());
    if (!location) return;
    const distance = haversineKm(location.lat, location.lng, lat, lng);
    if (distance > VOTE_DISTANCE_KM) {
      Alert.alert("Too far", "You need to be close to the report to vote.");
      return;
    }
    try {
      const updated = await apiPost<PoliceReport>(
        `/api/map/police-reports/${reportId}/vote`,
        { vote, lat: location.lat, lng: location.lng },
        authHeader
      );
      setPoliceReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      Alert.alert("Error", "Unable to submit vote.");
    }
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
            <Pressable style={styles.headerBtn} onPress={() => router.push("/create/route")}>
              <Ionicons name="trail-sign" size={18} color={Colors.text} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => router.push("/create/event")}>
              <Ionicons name="calendar" size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        <MapCanvas
          mapRef={mapRef}
          region={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPanDrag={handlePanDrag}
          onRecenter={handleRecenter}
          onSearchArea={handleSearchArea}
          showSearchArea={showSearchArea}
          events={events}
          gasMarkers={gasMarkers}
          policeReports={policeReports}
          showEvents={showEvents}
          showGas={showGas}
          showService={showService}
          onToggleEvents={() => setShowEvents((prev) => !prev)}
          onToggleGas={() => setShowGas((prev) => !prev)}
          onToggleService={() => setShowService((prev) => !prev)}
          onReportPolice={handleReportPolice}
          onVotePolice={handleVotePolice}
          isFetching={isFetching}
          userLocation={userLocation}
          onEventPress={(eventId) => router.push(`/event/${eventId}`)}
        />
      </View>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add report here?</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setReportModalVisible(false)}
                disabled={creatingReport}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={handleConfirmReport}
                disabled={creatingReport}
              >
                <Text style={styles.modalConfirmText}>{creatingReport ? "Adding..." : "Yes"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  modalCancel: {
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalConfirm: {
    backgroundColor: Colors.accent,
  },
  modalCancelText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
  modalConfirmText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
});
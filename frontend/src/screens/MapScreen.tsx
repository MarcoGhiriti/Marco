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

type FriendLocation = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
  lat: number;
  lng: number;
  updated_at: string;
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
  
  // Create menu state
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  
  // Friends location sharing state
  const [sharingLocation, setSharingLocation] = useState(false);
  const [showLocationPill, setShowLocationPill] = useState(false);
  const pillOpacity = useRef(new Animated.Value(0)).current;

  // Friends on map state
  const [showFriends, setShowFriends] = useState(false);
  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);
  const friendsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSharingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Toggle location sharing
  const toggleLocationSharing = async () => {
    const newState = !sharingLocation;
    setSharingLocation(newState);
    
    if (newState) {
      // Show toast-style pill for 2 seconds, then auto-hide
      setShowLocationPill(true);
      Animated.sequence([
        Animated.timing(pillOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(pillOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowLocationPill(false));
      
      // Request location permission if needed
      await requestLocation();

      // Start sending location updates every 15s
      const sendUpdate = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await apiPost("/api/location/update", { lat: loc.coords.latitude, lng: loc.coords.longitude }, accessToken || "");
        } catch {}
      };
      sendUpdate();
      locationSharingIntervalRef.current = setInterval(sendUpdate, 15000);
    } else {
      // Hide pill immediately
      setShowLocationPill(false);
      pillOpacity.setValue(0);
      // Stop sending location updates
      if (locationSharingIntervalRef.current) {
        clearInterval(locationSharingIntervalRef.current);
        locationSharingIntervalRef.current = null;
      }
    }
  };

  // Fetch friends' locations
  const fetchFriendsLocations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiGet("/api/friends/locations", accessToken);
      if (Array.isArray(data)) setFriendLocations(data);
    } catch {}
  }, [accessToken]);

  // Start/stop friends polling based on showFriends toggle
  useEffect(() => {
    if (showFriends) {
      fetchFriendsLocations();
      friendsIntervalRef.current = setInterval(fetchFriendsLocations, 20000);
    } else {
      setFriendLocations([]);
      if (friendsIntervalRef.current) {
        clearInterval(friendsIntervalRef.current);
        friendsIntervalRef.current = null;
      }
    }
    return () => {
      if (friendsIntervalRef.current) {
        clearInterval(friendsIntervalRef.current);
        friendsIntervalRef.current = null;
      }
    };
  }, [showFriends, fetchFriendsLocations]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (locationSharingIntervalRef.current) clearInterval(locationSharingIntervalRef.current);
      if (friendsIntervalRef.current) clearInterval(friendsIntervalRef.current);
    };
  }, []);

  // Handle Create menu item selection
  const handleCreateSelect = (type: "route" | "meetup") => {
    setCreateMenuVisible(false);
    if (type === "route") {
      router.push("/create/route");
    } else {
      router.push("/create/event");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Live Map</Text>
            <Text style={styles.sub}>Friends & events nearby</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Friends Location Toggle */}
            <Pressable 
              style={[styles.headerBtn, sharingLocation && styles.headerBtnActive]} 
              onPress={toggleLocationSharing}
            >
              <Ionicons 
                name={sharingLocation ? "location" : "location-outline"} 
                size={20} 
                color={sharingLocation ? Colors.accent : Colors.text} 
              />
            </Pressable>
            
            {/* Create Button */}
            <Pressable 
              style={[styles.headerBtn, styles.createBtn]} 
              onPress={() => setCreateMenuVisible(true)}
            >
              <Ionicons name="add" size={22} color={Colors.bg} />
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
          showFriends={showFriends}
          friendMarkers={friendLocations}
          onToggleEvents={() => setShowEvents((prev) => !prev)}
          onToggleGas={() => setShowGas((prev) => !prev)}
          onToggleService={() => setShowService((prev) => !prev)}
          onToggleFriends={() => setShowFriends((prev) => !prev)}
          onReportPolice={handleReportPolice}
          onVotePolice={handleVotePolice}
          isFetching={isFetching}
          userLocation={userLocation}
          onEventPress={(eventId) => router.push(`/event/${eventId}`)}
        />

        {showLocationPill && (
          <Animated.View style={[styles.locationPill, { opacity: pillOpacity }]} data-testid="location-sharing-pill">
            <Ionicons name="radio" size={14} color={Colors.accent} />
            <Text style={styles.locationPillText}>Sharing live location</Text>
          </Animated.View>
        )}
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

      {/* Create Menu Bottom Sheet */}
      <Modal
        visible={createMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateMenuVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setCreateMenuVisible(false)}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Create</Text>
            
            <Pressable 
              style={styles.sheetOption} 
              onPress={() => handleCreateSelect("route")}
            >
              <View style={styles.sheetOptionIcon}>
                <Ionicons name="trail-sign" size={22} color={Colors.accent} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Create Route</Text>
                <Text style={styles.sheetOptionSub}>Plan a ride with start & finish points</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </Pressable>
            
            <Pressable 
              style={styles.sheetOption} 
              onPress={() => handleCreateSelect("meetup")}
            >
              <View style={styles.sheetOptionIcon}>
                <Ionicons name="people" size={22} color={Colors.accent} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Create Meetup</Text>
                <Text style={styles.sheetOptionSub}>Set a meeting point & time</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </Pressable>
          </View>
        </Pressable>
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
  headerBtnActive: {
    backgroundColor: Colors.accent + "20",
    borderColor: Colors.accent,
  },
  createBtn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  locationPill: {
    position: "absolute",
    bottom: 72,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
    zIndex: 100,
  },
  locationPillText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
  
  // Bottom Sheet styles
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sheetOptionSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
});
import React, { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

// Conditionally import MapView only on native
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

type Point = { lat: number; lng: number };

export default function CreateEventScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [meetingPoint, setMeetingPoint] = useState<Point | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // For web, use text input for coordinates
  const [latInput, setLatInput] = useState("44.4268");
  const [lngInput, setLngInput] = useState("26.1025");

  const [region, setRegion] = useState({
    latitude: 44.4268,
    longitude: 26.1025,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
      setLatInput(loc.coords.latitude.toString());
      setLngInput(loc.coords.longitude.toString());
    }
  }, []);

  React.useEffect(() => {
    loadLocation();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDateStr(tomorrow.toISOString().split("T")[0]);
    setTimeStr("10:00");
  }, [loadLocation]);

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMeetingPoint({ lat: latitude, lng: longitude });
  };
  
  const handleWebSetPoint = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setMeetingPoint({ lat, lng });
    }
  };

  const handleCreate = async () => {
    if (!headers || !meetingPoint || !title.trim() || !dateStr || !timeStr) return;

    setLoading(true);
    setError(null);
    try {
      const startTime = new Date(`${dateStr}T${timeStr}:00`);
      if (isNaN(startTime.getTime())) {
        setError("Invalid date or time format");
        setLoading(false);
        return;
      }

      await apiPost(
        "/api/events",
        {
          title: title.trim(),
          description: description.trim(),
          start_point: [meetingPoint.lat, meetingPoint.lng],
          start_time: startTime.toISOString(),
        },
        headers
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const renderWebMapFallback = () => (
    <View style={styles.webFallback}>
      <Ionicons name="location" size={48} color={Colors.accent} />
      <Text style={styles.webFallbackTitle}>Set Meeting Point</Text>
      <Text style={styles.webFallbackSub}>
        Maps work on mobile. Enter coordinates manually:
      </Text>
      <View style={styles.coordRow}>
        <View style={styles.coordField}>
          <Text style={styles.coordLabel}>Latitude</Text>
          <TextInput
            value={latInput}
            onChangeText={setLatInput}
            keyboardType="numeric"
            style={styles.coordInput}
            placeholderTextColor={Colors.muted}
          />
        </View>
        <View style={styles.coordField}>
          <Text style={styles.coordLabel}>Longitude</Text>
          <TextInput
            value={lngInput}
            onChangeText={setLngInput}
            keyboardType="numeric"
            style={styles.coordInput}
            placeholderTextColor={Colors.muted}
          />
        </View>
      </View>
      <Pressable onPress={handleWebSetPoint} style={styles.setPointBtn}>
        <Ionicons name="checkmark" size={18} color={Colors.bg} />
        <Text style={styles.setPointBtnText}>Set Point</Text>
      </Pressable>
      {meetingPoint && (
        <View style={styles.pointSetBadge}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.pointSetText}>
            Point set: {meetingPoint.lat.toFixed(4)}, {meetingPoint.lng.toFixed(4)}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Meeting Point" : "Event Details"}
          </Text>
          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={!meetingPoint}
              style={[
                styles.headerBtn,
                styles.nextBtn,
                !meetingPoint && styles.nextBtnDisabled,
              ]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCreate}
              disabled={loading || !title.trim() || !dateStr || !timeStr}
              style={[
                styles.headerBtn,
                styles.nextBtn,
                (loading || !title.trim()) && styles.nextBtnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.nextBtnText}>Create</Text>
              )}
            </Pressable>
          )}
        </View>

        {step === 1 ? (
          <View style={styles.mapContainer}>
            {Platform.OS === "web" ? (
              renderWebMapFallback()
            ) : MapView ? (
              <>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={region}
                  onRegionChangeComplete={setRegion}
                  onPress={handleMapPress}
                  showsUserLocation
                  customMapStyle={darkMapStyle}
                >
                  {meetingPoint && (
                    <Marker
                      coordinate={{
                        latitude: meetingPoint.lat,
                        longitude: meetingPoint.lng,
                      }}
                    >
                      <View style={styles.meetingMarker}>
                        <Ionicons name="flag" size={20} color="#FFF" />
                      </View>
                    </Marker>
                  )}
                </MapView>
                <View style={styles.instructions}>
                  <Ionicons name="location" size={18} color={Colors.accent} />
                  <Text style={styles.instructionsText}>
                    Tap on the map to set the meeting point.
                  </Text>
                </View>
                {meetingPoint && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.selectedBadgeText}>Meeting point set</Text>
                  </View>
                )}
              </>
            ) : (
              renderWebMapFallback()
            )}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Event Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="E.g. Weekend Ride to Mountains"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
                maxLength={80}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What's the plan?"
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
                maxLength={800}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Date & Time *</Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
                  <TextInput
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.muted}
                    style={styles.dateTimeInput}
                  />
                </View>
                <View style={styles.dateTimeField}>
                  <Ionicons name="time-outline" size={18} color={Colors.muted} />
                  <TextInput
                    value={timeStr}
                    onChangeText={setTimeStr}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.muted}
                    style={styles.dateTimeInput}
                  />
                </View>
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
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
  headerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  nextBtn: { width: 80, backgroundColor: Colors.accent, borderColor: Colors.accent },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  meetingMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  instructions: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  instructionsText: { flex: 1, color: Colors.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  selectedBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedBadgeText: { color: Colors.success, fontSize: 12, fontFamily: "Inter_700Bold" },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  webFallbackTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  webFallbackSub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  coordRow: { flexDirection: "row", gap: 12, width: "100%" },
  coordField: { flex: 1 },
  coordLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_700Bold", marginBottom: 6 },
  coordInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  setPointBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setPointBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  pointSetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pointSetText: { color: Colors.success, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  formContainer: { padding: 16, gap: 12 },
  formCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  formLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8 },
  formInput: {
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  formTextarea: { height: 100, textAlignVertical: "top" },
  dateTimeRow: { flexDirection: "row", gap: 10 },
  dateTimeField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  dateTimeInput: { flex: 1, height: 44, color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorText: { color: Colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

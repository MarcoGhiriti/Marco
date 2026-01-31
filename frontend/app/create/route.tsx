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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Point = { lat: number; lng: number };

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

export default function CreateRouteScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1); // 1: map, 2: details
  const [points, setPoints] = useState<Point[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, []);

  React.useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoints([...points, { lat: latitude, lng: longitude }]);
  };

  const removeLastPoint = () => {
    setPoints(points.slice(0, -1));
  };

  const clearPoints = () => {
    setPoints([]);
  };

  const handleCreate = async () => {
    if (!headers || points.length < 2 || !title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const polyline = points.map((p) => [p.lat, p.lng]);
      await apiPost(
        "/api/routes",
        {
          title: title.trim(),
          description: description.trim(),
          polyline,
          difficulty,
        },
        headers
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Draw Route" : "Route Details"}
          </Text>
          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={points.length < 2}
              style={[
                styles.headerBtn,
                styles.nextBtn,
                points.length < 2 && styles.nextBtnDisabled,
              ]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCreate}
              disabled={loading || !title.trim()}
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
          /* Step 1: Map */
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
              showsUserLocation
              customMapStyle={darkMapStyle}
            >
              {points.map((p, i) => (
                <Marker
                  key={i}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  pinColor={i === 0 ? Colors.success : i === points.length - 1 ? Colors.danger : Colors.accent}
                >
                  <View style={[styles.pointMarker, i === 0 && styles.startMarker, i === points.length - 1 && styles.endMarker]}>
                    <Text style={styles.pointMarkerText}>{i + 1}</Text>
                  </View>
                </Marker>
              ))}
              {points.length >= 2 && (
                <Polyline
                  coordinates={points.map((p) => ({
                    latitude: p.lat,
                    longitude: p.lng,
                  }))}
                  strokeColor={Colors.accent}
                  strokeWidth={4}
                />
              )}
            </MapView>

            {/* Map Controls */}
            <View style={styles.mapControls}>
              <Pressable
                onPress={removeLastPoint}
                disabled={points.length === 0}
                style={[styles.mapControlBtn, points.length === 0 && styles.mapControlBtnDisabled]}
              >
                <Ionicons name="arrow-undo" size={20} color={Colors.text} />
              </Pressable>
              <Pressable
                onPress={clearPoints}
                disabled={points.length === 0}
                style={[styles.mapControlBtn, points.length === 0 && styles.mapControlBtnDisabled]}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
              <Ionicons name="finger-print" size={18} color={Colors.accent} />
              <Text style={styles.instructionsText}>
                Tap on the map to add points. Min 2 points required.
              </Text>
            </View>

            {/* Points Counter */}
            <View style={styles.pointsCounter}>
              <Text style={styles.pointsCounterText}>
                {points.length} points
              </Text>
            </View>
          </View>
        ) : (
          /* Step 2: Details Form */
          <ScrollView
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setStep(1)} style={styles.miniMapContainer}>
              <MapView
                style={styles.miniMap}
                provider={PROVIDER_GOOGLE}
                region={{
                  latitude: points[0]?.lat || region.latitude,
                  longitude: points[0]?.lng || region.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                customMapStyle={darkMapStyle}
              >
                {points.length >= 2 && (
                  <Polyline
                    coordinates={points.map((p) => ({
                      latitude: p.lat,
                      longitude: p.lng,
                    }))}
                    strokeColor={Colors.accent}
                    strokeWidth={3}
                  />
                )}
              </MapView>
              <View style={styles.miniMapOverlay}>
                <Ionicons name="create-outline" size={16} color={Colors.text} />
                <Text style={styles.miniMapText}>Tap to edit route</Text>
              </View>
            </Pressable>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="E.g. Mountain Adventure"
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
                placeholder="Describe the route..."
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
                maxLength={800}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[
                      styles.difficultyBtn,
                      difficulty === d && styles.difficultyBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.difficultyBtnText,
                        difficulty === d && styles.difficultyBtnTextActive,
                      ]}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Text>
                  </Pressable>
                ))}
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
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
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
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  nextBtn: {
    width: 80,
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  pointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  startMarker: { backgroundColor: Colors.success },
  endMarker: { backgroundColor: Colors.danger },
  pointMarkerText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  mapControls: {
    position: "absolute",
    right: 12,
    top: 12,
    gap: 8,
  },
  mapControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlBtnDisabled: {
    opacity: 0.5,
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
  instructionsText: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  pointsCounter: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pointsCounterText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  formContainer: {
    padding: 16,
    gap: 12,
  },
  miniMapContainer: {
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniMap: { flex: 1 },
  miniMapOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  miniMapText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  formCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  formLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
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
  formTextarea: {
    height: 100,
    textAlignVertical: "top",
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 10,
  },
  difficultyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
  },
  difficultyBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  difficultyBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  difficultyBtnTextActive: {
    color: Colors.bg,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

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

type Point = { lat: number; lng: number };

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

export default function CreateRouteScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [points, setPoints] = useState<Point[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For web input
  const [latInput, setLatInput] = useState("44.4268");
  const [lngInput, setLngInput] = useState("26.1025");

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setLatInput(loc.coords.latitude.toFixed(6));
        setLngInput(loc.coords.longitude.toFixed(6));
      }
    } catch (e) {
      console.log("Location not available");
    }
  }, []);

  React.useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const addPoint = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setPoints([...points, { lat, lng }]);
    }
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Add Points" : "Route Details"}
          </Text>
          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={points.length < 2}
              style={[styles.headerBtn, styles.nextBtn, points.length < 2 && styles.nextBtnDisabled]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCreate}
              disabled={loading || !title.trim()}
              style={[styles.headerBtn, styles.nextBtn, (loading || !title.trim()) && styles.nextBtnDisabled]}
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
          <ScrollView contentContainerStyle={styles.step1Content}>
            <View style={styles.locationCard}>
              <Ionicons name="trail-sign" size={48} color={Colors.accent} />
              <Text style={styles.locationTitle}>Build Your Route</Text>
              <Text style={styles.locationSub}>
                Add at least 2 points to create a route. On mobile, you can tap points on the map.
              </Text>

              <View style={styles.coordRow}>
                <View style={styles.coordField}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <TextInput
                    value={latInput}
                    onChangeText={setLatInput}
                    keyboardType="numeric"
                    style={styles.coordInput}
                    placeholder="e.g. 44.4268"
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
                    placeholder="e.g. 26.1025"
                    placeholderTextColor={Colors.muted}
                  />
                </View>
              </View>

              <View style={styles.btnRow}>
                <Pressable onPress={addPoint} style={styles.addPointBtn}>
                  <Ionicons name="add" size={18} color={Colors.bg} />
                  <Text style={styles.addPointBtnText}>Add Point</Text>
                </Pressable>
                <Pressable onPress={removeLastPoint} disabled={points.length === 0} style={[styles.undoBtn, points.length === 0 && styles.undoBtnDisabled]}>
                  <Ionicons name="arrow-undo" size={18} color={Colors.text} />
                </Pressable>
                <Pressable onPress={clearPoints} disabled={points.length === 0} style={[styles.undoBtn, points.length === 0 && styles.undoBtnDisabled]}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </Pressable>
              </View>

              <View style={styles.pointsBadge}>
                <Ionicons name="location" size={16} color={Colors.accent} />
                <Text style={styles.pointsBadgeText}>{points.length} points added</Text>
              </View>

              {points.length > 0 && (
                <View style={styles.pointsList}>
                  {points.map((p, i) => (
                    <View key={i} style={styles.pointItem}>
                      <View style={[styles.pointDot, i === 0 && styles.pointDotStart, i === points.length - 1 && styles.pointDotEnd]}>
                        <Text style={styles.pointDotText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.pointCoords}>
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Pressable onPress={loadLocation} style={styles.useCurrentBtn}>
                <Ionicons name="locate" size={16} color={Colors.accent} />
                <Text style={styles.useCurrentBtnText}>Use my current location</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
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
                    style={[styles.difficultyBtn, difficulty === d && styles.difficultyBtnActive]}
                  >
                    <Text style={[styles.difficultyBtnText, difficulty === d && styles.difficultyBtnTextActive]}>
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
  step1Content: { padding: 16 },
  locationCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  locationTitle: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black" },
  locationSub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  coordRow: { flexDirection: "row", gap: 12, width: "100%" },
  coordField: { flex: 1 },
  coordLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_700Bold", marginBottom: 6 },
  coordInput: {
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
  btnRow: { flexDirection: "row", gap: 10 },
  addPointBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addPointBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  undoBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  undoBtnDisabled: { opacity: 0.5 },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pointsBadgeText: { color: Colors.accent, fontSize: 13, fontFamily: "Inter_700Bold" },
  pointsList: { width: "100%", gap: 8 },
  pointItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  pointDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pointDotStart: { backgroundColor: Colors.success },
  pointDotEnd: { backgroundColor: Colors.danger },
  pointDotText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  pointCoords: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  useCurrentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  useCurrentBtnText: { color: Colors.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  difficultyRow: { flexDirection: "row", gap: 10 },
  difficultyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
  },
  difficultyBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  difficultyBtnText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
  difficultyBtnTextActive: { color: Colors.bg },
  errorText: { color: Colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

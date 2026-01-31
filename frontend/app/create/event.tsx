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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDateStr(tomorrow.toISOString().split("T")[0]);
    setTimeStr("10:00");
  }, [loadLocation]);

  const handleSetPoint = () => {
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
              style={[styles.headerBtn, styles.nextBtn, !meetingPoint && styles.nextBtnDisabled]}
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
              <Ionicons name="location" size={48} color={Colors.accent} />
              <Text style={styles.locationTitle}>Set Meeting Point</Text>
              <Text style={styles.locationSub}>
                Enter coordinates for the event meeting location.
                {Platform.OS !== "web" && " Use the map on mobile for precise selection."}
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

              <Pressable onPress={handleSetPoint} style={styles.setPointBtn}>
                <Ionicons name="checkmark" size={18} color={Colors.bg} />
                <Text style={styles.setPointBtnText}>Set Location</Text>
              </Pressable>

              {meetingPoint && (
                <View style={styles.pointSetBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.pointSetText}>
                    Location set: {meetingPoint.lat.toFixed(4)}, {meetingPoint.lng.toFixed(4)}
                  </Text>
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
  step1Content: { flex: 1, padding: 16, justifyContent: "center" },
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
  setPointBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  setPointBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  pointSetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pointSetText: { color: Colors.success, fontSize: 13, fontFamily: "Inter_600SemiBold" },
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

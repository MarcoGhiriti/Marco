import React, { useMemo, useState, useEffect } from "react";
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
import Svg, { Circle, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { PlaceSearchInput } from "../../src/components/PlaceSearchInput";

interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// Event types
const EVENT_TYPES = [
  { id: "opening", label: "Season Opening", icon: "sunny" },
  { id: "closing", label: "Season Closing", icon: "moon" },
  { id: "meetup", label: "Moto Meetup", icon: "people" },
  { id: "show", label: "Moto Show", icon: "star" },
  { id: "ride", label: "Group Ride", icon: "bicycle" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
] as const;

// Map Preview for single location
function EventMapPreview({ location }: { location: PlaceDetails | null }) {
  const width = 340;
  const height = 180;

  return (
    <View style={mapStyles.container}>
      {!location ? (
        <View style={mapStyles.placeholder}>
          <Ionicons name="location-outline" size={48} color={Colors.muted} />
          <Text style={mapStyles.placeholderText}>
            Select meeting point
          </Text>
        </View>
      ) : (
        <View style={mapStyles.mapContent}>
          <Svg width={width} height={height}>
            {/* Grid pattern */}
            {Array.from({ length: 8 }).map((_, i) => (
              <Rect
                key={`h${i}`}
                x={0}
                y={i * 25}
                width={width}
                height={1}
                fill={Colors.border}
                opacity={0.3}
              />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <Rect
                key={`v${i}`}
                x={i * 25}
                y={0}
                width={1}
                height={height}
                fill={Colors.border}
                opacity={0.3}
              />
            ))}
            
            {/* Center pin */}
            <Circle cx={width / 2} cy={height / 2} r={20} fill={Colors.accent} opacity={0.2} />
            <Circle cx={width / 2} cy={height / 2} r={12} fill={Colors.accent} />
            <Circle cx={width / 2} cy={height / 2} r={4} fill={Colors.bg} />
          </Svg>
          
          {/* Location info overlay */}
          <View style={mapStyles.locationInfo}>
            <Ionicons name="location" size={18} color={Colors.accent} />
            <View style={mapStyles.locationTextContainer}>
              <Text style={mapStyles.locationName} numberOfLines={1}>
                {location.name}
              </Text>
              <Text style={mapStyles.locationAddress} numberOfLines={1}>
                {location.address}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: 180,
    backgroundColor: Colors.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholderText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  mapContent: {
    flex: 1,
  },
  locationInfo: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  locationAddress: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
});

export default function CreateEventScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [meetingLocation, setMeetingLocation] = useState<PlaceDetails | null>(null);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<string>("meetup");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Set default date/time
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7); // Default to 1 week from now
    setDateStr(tomorrow.toISOString().split("T")[0]);
    setTimeStr("10:00");
  }, []);

  const canProceed = meetingLocation !== null;

  const handleCreate = async () => {
    if (!headers || !meetingLocation || !title.trim() || !dateStr || !timeStr) return;

    setLoading(true);
    setError(null);
    try {
      const startTime = new Date(`${dateStr}T${timeStr}:00`);
      if (isNaN(startTime.getTime())) {
        setError("Format dată/oră invalid");
        setLoading(false);
        return;
      }

      await apiPost(
        "/api/events",
        {
          title: title.trim(),
          description: description.trim(),
          start_point: [meetingLocation.lat, meetingLocation.lng],
          location_name: meetingLocation.address || meetingLocation.name,
          start_time: startTime.toISOString(),
          event_type: eventType,
        },
        headers
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la crearea evenimentului");
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
            {step === 1 ? "New Event" : "Event Details"}
          </Text>
          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={!canProceed}
              style={[styles.headerBtn, styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
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
                <Text style={styles.nextBtnText}>Creează</Text>
              )}
            </Pressable>
          )}
        </View>

        {step === 1 ? (
          <ScrollView 
            contentContainerStyle={styles.step1Content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="calendar" size={24} color={Colors.accent} />
              <View style={styles.infoBannerText}>
                <Text style={styles.infoBannerTitle}>Creează un Eveniment</Text>
                <Text style={styles.infoBannerSub}>
                  Evenimentele sunt adunări de motocicliști, nu trasee. Selectează punctul de întâlnire.
                </Text>
              </View>
            </View>

            {/* Map Preview */}
            <EventMapPreview location={meetingLocation} />

            {/* Search Input */}
            <View style={styles.searchSection}>
              <PlaceSearchInput
                label="PUNCT DE ÎNTÂLNIRE"
                placeholder="Caută locația evenimentului..."
                icon="location"
                iconColor={Colors.accent}
                onPlaceSelected={(place) => setMeetingLocation(place)}
                headers={headers}
              />
            </View>

            {/* Selected Location Card */}
            {meetingLocation && (
              <View style={styles.selectedCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <View style={styles.selectedCardText}>
                  <Text style={styles.selectedCardTitle}>Locație selectată</Text>
                  <Text style={styles.selectedCardAddress} numberOfLines={2}>
                    {meetingLocation.address}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
            {/* Location Summary */}
            {meetingLocation && (
              <View style={styles.summaryCard}>
                <Ionicons name="location" size={18} color={Colors.accent} />
                <Text style={styles.summaryText} numberOfLines={1}>
                  {meetingLocation.name}
                </Text>
              </View>
            )}

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Titlu Eveniment *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Deschidere Sezon 2025"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
                maxLength={80}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Tip Eveniment</Text>
              <View style={styles.eventTypeGrid}>
                {EVENT_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    onPress={() => setEventType(type.id)}
                    style={[
                      styles.eventTypeBtn,
                      eventType === type.id && styles.eventTypeBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={type.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={eventType === type.id ? Colors.bg : Colors.text}
                    />
                    <Text
                      style={[
                        styles.eventTypeBtnText,
                        eventType === type.id && styles.eventTypeBtnTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Descriere</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Detalii despre eveniment..."
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
                maxLength={800}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Data & Ora *</Text>
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

  step1Content: {
    padding: 16,
    gap: 16,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  infoBannerSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },

  searchSection: {
    zIndex: 100,
  },

  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 14,
    padding: 16,
  },
  selectedCardText: {
    flex: 1,
  },
  selectedCardTitle: {
    color: Colors.success,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  selectedCardAddress: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },

  formContainer: { padding: 16, gap: 12 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  summaryText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
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

  eventTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  eventTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  eventTypeBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  eventTypeBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  eventTypeBtnTextActive: {
    color: Colors.bg,
  },

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

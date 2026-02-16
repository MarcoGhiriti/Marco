import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPatch } from "../../src/lib/api";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuthStore } from "../../src/state/authStore";

type Privacy = {
  location_visible: boolean;
  routes_visible: string;
  km_visible: boolean;
  last_active_visible: boolean;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { accessToken, me, refreshMe } = useAuthStore();

  const [bio, setBio] = useState(me?.bio ?? "");
  const [bikeModel, setBikeModel] = useState(me?.bike?.model ?? "");
  const [bikeCc, setBikeCc] = useState(me?.bike?.cc ? String(me.bike.cc) : "");
  const [country, setCountry] = useState(me?.country ?? "");

  const [privacy, setPrivacy] = useState<Privacy>({
    location_visible: false,
    routes_visible: "public",
    km_visible: true,
    last_active_visible: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoBase64, setPhotoBase64] = useState<string | null>(
    me?.profile_photo_base64 ?? null,
  );

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Fetch full profile with privacy settings
  const loadPrivacy = useCallback(async () => {
    if (!headers || !me?.id) return;
    try {
      const data = await apiGet<any>(`/api/users/${me.id}`, headers);
      // The full /api/me response has privacy
      const fullMe = await apiGet<any>("/api/me", headers);
      if (fullMe.privacy) {
        setPrivacy({
          location_visible: fullMe.privacy.location_visible ?? false,
          routes_visible: fullMe.privacy.routes_visible ?? "public",
          km_visible: fullMe.privacy.km_visible ?? true,
          last_active_visible: fullMe.privacy.last_active_visible ?? true,
        });
      }
    } catch (e) {
      // Fall through with defaults
    }
  }, [headers, me?.id]);

  useEffect(() => { loadPrivacy(); }, [loadPrivacy]);

  const pickPhoto = async () => {
    if (!headers) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo permission is required");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });

    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset) return;

    const manip = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );

    const b64 = manip.base64 ? `data:image/jpeg;base64,${manip.base64}` : null;
    if (!b64) {
      setError("Failed to process image");
      return;
    }

    setPhotoBase64(b64);
  };

  const onSave = async () => {
    if (!headers) return;
    Keyboard.dismiss();

    setError(null);
    setSaving(true);
    try {
      const cc = bikeCc.trim() ? Number(bikeCc.trim()) : undefined;
      await apiPatch(
        "/api/me",
        {
          bio: bio.trim(),
          country: country.trim() ? country.trim().toUpperCase() : null,
          bike: {
            model: bikeModel.trim() ? bikeModel.trim() : null,
            cc: Number.isFinite(cc) ? cc : null,
          },
          privacy,
          profile_photo_base64: photoBase64,
        },
        headers,
      );
      await refreshMe();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePrivacy = (key: keyof Privacy) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleRoutesVisibility = () => {
    setPrivacy(prev => ({
      ...prev,
      routes_visible:
        prev.routes_visible === "public"
          ? "friends"
          : prev.routes_visible === "friends"
            ? "private"
            : "public",
    }));
  };

  const routesLabel =
    privacy.routes_visible === "public"
      ? "Toți"
      : privacy.routes_visible === "friends"
        ? "Doar prieteni"
        : "Nimeni";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn} data-testid="edit-back-btn">
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Editare profil</Text>
          <Pressable onPress={onSave} style={styles.headerBtn} data-testid="edit-save-btn">
            {saving ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Ionicons name="checkmark" size={20} color={Colors.accent} />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo & Username */}
          <View style={styles.card}>
            <View style={styles.photoRow}>
              <View style={styles.photoCircle}>
                {photoBase64 ? (
                  <Image
                    source={{ uri: photoBase64 }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={22} color={Colors.text} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Username</Text>
                <Text style={styles.value}>{me?.username ?? ""}</Text>
              </View>
              <Pressable onPress={pickPhoto} style={styles.photoBtn} data-testid="pick-photo-btn">
                <Ionicons name="image-outline" size={18} color={Colors.accent} />
              </Pressable>
            </View>
          </View>

          {/* Motorcycle */}
          <View style={styles.card}>
            <Text style={styles.label}>Motocicletă</Text>
            <TextInput
              value={bikeModel}
              onChangeText={setBikeModel}
              placeholder="Model (ex. MT-07)"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              data-testid="bike-model-input"
            />
            <TextInput
              value={bikeCc}
              onChangeText={setBikeCc}
              placeholder="CC (ex. 689)"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              style={[styles.input, { marginTop: 10 }]}
              data-testid="bike-cc-input"
            />
          </View>

          {/* Country */}
          <View style={styles.card}>
            <Text style={styles.label}>Țară</Text>
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="RO"
              placeholderTextColor={Colors.muted}
              autoCapitalize="characters"
              maxLength={2}
              style={styles.input}
              data-testid="country-input"
            />
            <Text style={styles.help}>
              Pentru reglementări locale.
            </Text>
          </View>

          {/* Privacy Settings */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Confidențialitate</Text>

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Ionicons name="location-outline" size={18} color={Colors.accent} />
                <View>
                  <Text style={styles.privacyLabel}>Locație vizibilă</Text>
                  <Text style={styles.privacyDesc}>Arată orașul pe profil</Text>
                </View>
              </View>
              <Switch
                value={privacy.location_visible}
                onValueChange={() => togglePrivacy("location_visible")}
                trackColor={{ false: Colors.card2, true: Colors.accent + "60" }}
                thumbColor={privacy.location_visible ? Colors.accent : Colors.muted}
                data-testid="privacy-location-toggle"
              />
            </View>

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Ionicons name="speedometer-outline" size={18} color={Colors.accent} />
                <View>
                  <Text style={styles.privacyLabel}>Km total vizibil</Text>
                  <Text style={styles.privacyDesc}>Arată kilometrii pe profil</Text>
                </View>
              </View>
              <Switch
                value={privacy.km_visible}
                onValueChange={() => togglePrivacy("km_visible")}
                trackColor={{ false: Colors.card2, true: Colors.accent + "60" }}
                thumbColor={privacy.km_visible ? Colors.accent : Colors.muted}
                data-testid="privacy-km-toggle"
              />
            </View>

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Ionicons name="time-outline" size={18} color={Colors.accent} />
                <View>
                  <Text style={styles.privacyLabel}>Ultima activitate</Text>
                  <Text style={styles.privacyDesc}>Arată când ai fost activ</Text>
                </View>
              </View>
              <Switch
                value={privacy.last_active_visible}
                onValueChange={() => togglePrivacy("last_active_visible")}
                trackColor={{ false: Colors.card2, true: Colors.accent + "60" }}
                thumbColor={privacy.last_active_visible ? Colors.accent : Colors.muted}
                data-testid="privacy-active-toggle"
              />
            </View>

            <Pressable style={styles.privacyRow} onPress={cycleRoutesVisibility} data-testid="privacy-routes-btn">
              <View style={styles.privacyInfo}>
                <Ionicons name="map-outline" size={18} color={Colors.accent} />
                <View>
                  <Text style={styles.privacyLabel}>Cine vede rutele</Text>
                  <Text style={styles.privacyDesc}>Vizibilitate rute: {routesLabel}</Text>
                </View>
              </View>
              <View style={styles.cycleBtn}>
                <Text style={styles.cycleBtnText}>{routesLabel}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
              </View>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
  },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoCircle: {
    height: 48,
    width: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { height: 48, width: 48 },
  photoBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  value: {
    marginTop: 8,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  help: {
    marginTop: 8,
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  error: { color: Colors.danger, fontSize: 12, fontFamily: "Inter_700Bold" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  privacyInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  privacyLabel: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  privacyDesc: { color: Colors.muted, fontSize: 11 },
  cycleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.card2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cycleBtnText: { color: Colors.accent, fontSize: 12, fontWeight: "700" },
});

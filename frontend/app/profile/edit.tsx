import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

export default function EditProfileScreen() {
  const router = useRouter();
  const { accessToken, me, refreshMe } = useAuthStore();

  const [bio, setBio] = useState(me?.bio ?? "");
  const [bikeModel, setBikeModel] = useState(me?.bike?.model ?? "");
  const [bikeCc, setBikeCc] = useState(me?.bike?.cc ? String(me.bike.cc) : "");
  const [country, setCountry] = useState(me?.country ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const onSave = async () => {
    if (!headers) return;
    Keyboard.dismiss();
    setError(null);
    setSaving(true);
    try {
      const cc = bikeCc.trim() ? Number(bikeCc.trim()) : undefined;
      await apiPost(
        "/api/me",
        {
          bio: bio.trim(),
          country: country.trim() ? country.trim().toUpperCase() : null,
          bike: {
            model: bikeModel.trim() ? bikeModel.trim() : null,
            cc: Number.isFinite(cc) ? cc : null,
          },
        },
        headers
      );
      await refreshMe();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
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
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <Pressable onPress={onSave} style={styles.headerBtn}>
            {saving ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Ionicons name="checkmark" size={20} color={Colors.accent} />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value}>{me?.username ?? ""}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell riders about you"
              placeholderTextColor={Colors.muted}
              style={[styles.input, { height: 96 }]}
              multiline
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Motorcycle</Text>
            <TextInput
              value={bikeModel}
              onChangeText={setBikeModel}
              placeholder="Model (e.g. MT-07)"
              placeholderTextColor={Colors.muted}
              style={styles.input}
            />
            <TextInput
              value={bikeCc}
              onChangeText={setBikeCc}
              placeholder="CC (e.g. 689)"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              style={[styles.input, { marginTop: 10 }]}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="RO"
              placeholderTextColor={Colors.muted}
              autoCapitalize="characters"
              maxLength={2}
              style={styles.input}
            />
            <Text style={styles.help}>Used for local regulations & reminders.</Text>
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
  headerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  label: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  value: { marginTop: 8, color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
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
  help: { marginTop: 8, color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  error: { color: Colors.danger, fontSize: 12, fontFamily: "Inter_700Bold" },
});

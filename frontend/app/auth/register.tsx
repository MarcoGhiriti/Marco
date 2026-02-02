import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    return !email.trim() || !username.trim() || !password.trim() || loading;
  }, [email, username, password, loading]);

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), username.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Register failed");
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
        <Pressable style={styles.container} onPress={() => Keyboard.dismiss()}>
          <View style={styles.header}>
            <Text style={styles.h1}>Create account</Text>
            <Text style={styles.sub}>Join the Moto GO community</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="ridername"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={disabled}
              style={({ pressed }) => [
                styles.primaryBtn,
                disabled && styles.primaryBtnDisabled,
                pressed && !disabled && { opacity: 0.92 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>Continue</Text>
              )}
            </Pressable>

            <View style={styles.row}>
              <Text style={styles.muted}>Already have an account?</Text>
              <Link href="/auth/login" asChild>
                <Pressable>
                  <Text style={styles.link}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 16 },
  header: { paddingTop: 18, paddingBottom: 14, gap: 6 },
  h1: { color: Colors.text, fontSize: 26, fontWeight: "900" },
  sub: { color: Colors.muted, fontSize: 13, fontWeight: "600" },
  form: {
    marginTop: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  label: { color: Colors.muted, fontSize: 12, fontWeight: "700" },
  input: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    paddingHorizontal: 14,
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  error: { marginTop: 10, color: Colors.danger, fontSize: 12, fontWeight: "700" },
  primaryBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.bg, fontSize: 14, fontWeight: "900" },
  row: { marginTop: 14, flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  muted: { color: Colors.muted, fontSize: 12, fontWeight: "700" },
  link: { color: Colors.accent, fontSize: 12, fontWeight: "900" },
});

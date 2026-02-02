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
import { useTranslation } from "react-i18next";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("user1@example.com");
  const [password, setPassword] = useState("Password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => !email.trim() || !password.trim() || loading, [email, password, loading]);

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("invalid credentials")) {
        setError(t("auth.invalidCredentials"));
      } else if (msg.toLowerCase().includes("invalid email")) {
        setError(t("auth.invalidEmail"));
      } else {
        setError(msg || t("errors.generic"));
      }
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
            <Text style={styles.h1}>{t("auth.signIn")}</Text>
            <Text style={styles.sub}>{t("auth.welcomeBack")}</Text>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Right now, our main focus is on building solid core features and a great riding experience.
              {"\n\n"}
              Some communication and social features are still evolving — and that’s intentional.
              {"\n\n"}
              We’re improving MotoGO step by step, with frequent updates that will make everything smoother, faster, and more powerful over time.
              {"\n\n"}
              Thanks for riding with us from the beginning 🏍️
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t("auth.email")}</Text>
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

            <Text style={[styles.label, { marginTop: 12 }]}>{t("auth.password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {/* Forgot Password Link */}
            <Link href="/auth/forgot-password" asChild>
              <Pressable style={styles.forgotPasswordRow}>
                <Text style={styles.forgotPasswordText}>{t("auth.forgotPassword")}</Text>
              </Pressable>
            </Link>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={disabled}
              style={[
                styles.primaryBtn,
                disabled && styles.primaryBtnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>{t("auth.continue")}</Text>
              )}
            </Pressable>

            <View style={styles.row}>
  notice: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  noticeText: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },

              <Text style={styles.muted}>{t("auth.noAccount")}</Text>
              <Link href="/auth/register" asChild>
                <Pressable>
                  <Text style={styles.link}>{t("auth.createOne")}</Text>
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
  h1: { color: Colors.text, fontSize: 26, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  form: {
    marginTop: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  label: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
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
    fontFamily: "Inter_600SemiBold",
  },
  error: { marginTop: 10, color: Colors.danger, fontSize: 12, fontWeight: "700" },
  forgotPasswordRow: {
    marginTop: 12,
    alignSelf: "flex-end",
  },
  forgotPasswordText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  primaryBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_900Black" },
  row: { marginTop: 14, flexDirection: "row", gap: 8, alignItems: "center" },
  muted: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  link: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_900Black" },
});

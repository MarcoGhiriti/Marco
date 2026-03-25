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
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";
import { startGoogleAuth } from "../../src/lib/googleAuth";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, loginWithToken } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const onGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const accessToken = await startGoogleAuth("/auth/login");
      await loginWithToken(accessToken);
      router.replace("/(tabs)/home");
    } catch (e) {
      console.error("Google login error:", e);
      const msg = e instanceof Error ? e.message : "Google login failed. Please try again.";
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.h1}>{t("auth.signIn")}</Text>
            <Text style={styles.sub}>{t("auth.welcomeBack")}</Text>
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialSection}>
            <Pressable
              style={styles.googleBtn}
              onPress={onGoogleLogin}
              disabled={googleLoading}
              data-testid="google-login-btn"
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.appleBtn} data-testid="apple-login-btn">
              <Ionicons name="logo-apple" size={20} color={Colors.text} />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email/Password Form */}
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
              placeholder="your password"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              style={styles.input}
            />

            <Link href="/auth/forgot-password" asChild>
              <Pressable style={styles.forgotPasswordRow}>
                <Text style={styles.forgotPasswordText}>{t("auth.forgotPassword")}</Text>
              </Pressable>
            </Link>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={disabled}
              style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>{t("auth.continue")}</Text>
              )}
            </Pressable>
          </View>

          {/* Bottom section */}
          <View style={styles.bottomSection}>
            <View style={styles.row}>
              <Text style={styles.muted}>{t("auth.noAccount")}</Text>
              <Link href="/auth/register" asChild>
                <Pressable><Text style={styles.link}>{t("auth.createOne")}</Text></Pressable>
              </Link>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Right now, our main focus is on building solid core features and a great riding experience.
                Some communication and social features are still evolving. We're improving MotoGO step by step.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { paddingTop: 18, paddingBottom: 14, gap: 6 },
  h1: { color: Colors.text, fontSize: 26, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Social Buttons
  socialSection: { gap: 10, marginTop: 8 },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    height: 52, borderRadius: 16, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    height: 52, borderRadius: 16, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  socialBtnText: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Form
  form: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16,
  },
  label: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  input: {
    marginTop: 8, height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2,
    paddingHorizontal: 14, color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold",
  },
  error: { marginTop: 10, color: Colors.danger, fontSize: 12, fontWeight: "700" },
  forgotPasswordRow: { marginTop: 12, alignSelf: "flex-end" },
  forgotPasswordText: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  primaryBtn: {
    marginTop: 16, height: 48, borderRadius: 14,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_900Black" },

  // Bottom
  bottomSection: { marginTop: 20, gap: 16 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  muted: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  link: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_900Black" },
  notice: {
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2,
  },
  noticeText: { color: Colors.muted, fontSize: 11, lineHeight: 17, fontFamily: "Inter_500Medium", textAlign: "center" },
});

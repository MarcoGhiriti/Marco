import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";
import { startGoogleAuth } from "../../src/lib/googleAuth";

export default function WelcomeScreen() {
  const router = useRouter();
  const { loginWithToken } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);

  const onGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const accessToken = await startGoogleAuth();
      if (accessToken) {
        await loginWithToken(accessToken);
        router.replace("/(tabs)/home");
      }
    } catch (e) {
      console.error("Google login error:", e);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Logo */}
        <View style={s.logoArea}>
          <View style={s.logoMark}>
            <Ionicons name="bicycle" size={28} color={Colors.bg} />
          </View>
          <Text style={s.logoText}>MotoGo</Text>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.h1}>Ride together.{"\n"}Find the best roads.</Text>
          <Text style={s.sub}>AI route suggestions + real-time rides with friends.</Text>
        </View>

        {/* Buttons */}
        <View style={s.actions}>
          {/* Register */}
          <Pressable
            style={s.primaryBtn}
            onPress={() => router.push("/auth/register")}
            data-testid="welcome-register-btn"
          >
            <Text style={s.primaryBtnText}>Register</Text>
          </Pressable>

          {/* Login */}
          <Pressable
            style={s.secondaryBtn}
            onPress={() => router.push("/auth/login")}
            data-testid="welcome-login-btn"
          >
            <Text style={s.secondaryBtnText}>Log in</Text>
          </Pressable>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or continue with</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={s.socialRow}>
            <Pressable
              style={s.socialBtn}
              onPress={onGoogleLogin}
              disabled={googleLoading}
              data-testid="welcome-google-btn"
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <>
                  <View style={s.socialIcon}>
                    <Text style={s.googleG}>G</Text>
                  </View>
                  <Text style={s.socialBtnText}>Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={s.socialBtn}
              disabled
              data-testid="welcome-apple-btn"
            >
              <View style={s.socialIcon}>
                <Ionicons name="logo-apple" size={18} color={Colors.text} />
              </View>
              <Text style={s.socialBtnText}>Apple</Text>
            </Pressable>
          </View>

          {/* Terms */}
          <Text style={s.terms}>
            By continuing, you agree to our{" "}
            <Text style={s.termsLink} onPress={() => Linking.openURL("https://motogo.life/terms")}>
              Terms
            </Text>
            {" & "}
            <Text style={s.termsLink} onPress={() => Linking.openURL("https://motogo.life/privacy")}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },

  // Logo — matches Home header sizing
  logoArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 24,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: Colors.text,
    fontSize: 22, // Home h1 fontSize
    fontWeight: "900", // Home h1 fontWeight
    letterSpacing: 0.2, // Home h1 letterSpacing
  },

  // Hero — center area
  hero: {
    gap: 14,
    paddingHorizontal: 4,
  },
  h1: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  sub: {
    color: Colors.muted,
    fontSize: 15, // slightly larger than Home sub (13) for readability
    fontWeight: "600",
    lineHeight: 22,
  },

  // Actions — bottom area
  actions: {
    gap: 12,
    paddingBottom: Platform.OS === "ios" ? 16 : 24,
  },

  // Primary button — matches login primaryBtn exactly
  primaryBtn: {
    height: 52,
    borderRadius: 14, // Home iconBtn/card radius
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: "900",
  },

  // Secondary button — ghost/outline style
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  // Social buttons
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  socialBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  // Terms
  terms: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16,
    paddingTop: 4,
  },
  termsLink: {
    color: Colors.accent,
    fontWeight: "700",
  },
});

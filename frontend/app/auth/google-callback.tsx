import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { completeGoogleAuthFromUrl } from "../../src/lib/googleAuth";
import { useAuthStore } from "../../src/state/authStore";
import { Colors } from "../../src/theme/colors";

export default function GoogleCallbackScreen() {
  const router = useRouter();
  const { loginWithToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    const finishGoogleLogin = async () => {
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      try {
        const initialUrl = await Linking.getInitialURL();
        const currentUrl = typeof window !== "undefined" ? window.location.href : null;
        const candidateUrl = currentUrl && currentUrl.includes("session_id=")
          ? currentUrl
          : initialUrl;

        if (!candidateUrl) {
          throw new Error("Google session was not returned");
        }

        const accessToken = await completeGoogleAuthFromUrl(candidateUrl);
        await loginWithToken(accessToken);
        router.replace("/(tabs)/home");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Google login failed";
        setError(msg);
      }
    };

    finishGoogleLogin();
  }, [loginWithToken, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card} data-testid="google-callback-screen">
        <Text style={styles.title}>MotoGO</Text>
        {error ? (
          <>
            <Text style={styles.error} data-testid="google-callback-error">{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/auth/login")}
              data-testid="google-callback-back-button"
            >
              <Text style={styles.buttonText}>Back to login</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.subtitle} data-testid="google-callback-loading">
              Finishing Google sign in...
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  button: {
    minWidth: 180,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_900Black",
  },
});
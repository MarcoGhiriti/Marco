import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

export default function PremiumSuccessScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [status, setStatus] = useState<string>("checking");
  const [attempts, setAttempts] = useState(0);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const pollStatus = useCallback(async () => {
    if (!headers || !session_id || attempts >= 10) return;
    try {
      const data = await apiGet<{ status: string; payment_status: string }>(
        `/api/premium/checkout/status/${session_id}`,
        headers,
      );
      if (data.payment_status === "paid") {
        setStatus("success");
      } else if (data.status === "expired") {
        setStatus("failed");
      } else {
        setAttempts((p) => p + 1);
        setTimeout(pollStatus, 2000);
      }
    } catch {
      setStatus("failed");
    }
  }, [headers, session_id, attempts]);

  useEffect(() => {
    if (session_id) pollStatus();
  }, [session_id]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {status === "checking" ? (
          <>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.title}>Processing Payment...</Text>
            <Text style={styles.desc}>Please wait while we confirm your subscription.</Text>
          </>
        ) : status === "success" ? (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.accent} />
            </View>
            <Text style={styles.title}>Welcome to Premium!</Text>
            <Text style={styles.desc}>Your MotoGO Premium subscription is now active. Enjoy all premium features.</Text>
            <Pressable
              style={styles.goBtn}
              onPress={() => router.replace("/premium")}
              data-testid="go-to-premium-btn"
            >
              <Ionicons name="diamond" size={20} color={Colors.bg} />
              <Text style={styles.goBtnText}>Go to Premium Dashboard</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.failIcon}>
              <Ionicons name="close-circle" size={64} color={Colors.danger} />
            </View>
            <Text style={styles.title}>Payment Failed</Text>
            <Text style={styles.desc}>Your payment could not be processed. Please try again.</Text>
            <Pressable
              style={[styles.goBtn, { backgroundColor: Colors.card }]}
              onPress={() => router.replace("/premium")}
            >
              <Text style={[styles.goBtnText, { color: Colors.text }]}>Back to Premium</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, gap: 20,
  },
  successIcon: { marginBottom: 8 },
  failIcon: { marginBottom: 8 },
  title: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black", textAlign: "center" },
  desc: {
    color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold",
    textAlign: "center", lineHeight: 22, maxWidth: 320,
  },
  goBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.accent, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 32, marginTop: 12,
  },
  goBtnText: { color: Colors.bg, fontSize: 16, fontFamily: "Inter_900Black" },
});

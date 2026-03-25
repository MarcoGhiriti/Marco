import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type PremiumStatus = {
  is_premium: boolean;
  premium_until: string | null;
  plan: string | null;
  price: number;
};

type PaymentMethodsStatus = {
  apple_pay_ready: boolean;
  google_pay_ready: boolean;
  stripe_removed: boolean;
  message: string;
};

const FEATURES = [
  {
    icon: "bicycle" as const,
    title: "Your Bike",
    desc: "Track insurance, ITP, service & maintenance",
    route: "/premium/your-bike",
  },
  {
    icon: "speedometer" as const,
    title: "Free Ride Mode",
    desc: "Full ride tracking with speed, distance & map",
    route: "/premium/free-ride",
  },
  {
    icon: "bookmark" as const,
    title: "Saved Routes",
    desc: "Your saved AI-generated routes & progress",
    route: "/premium/saved-routes",
  },
  {
    icon: "time" as const,
    title: "Ride History",
    desc: "Your route participations & free rides",
    route: "/premium/history",
  },
  {
    icon: "compass" as const,
    title: "Route Recommendations",
    desc: "3 curated route picks, refreshable daily",
    route: "/premium/recommendations",
  },
  {
    icon: "build" as const,
    title: "Maintenance Tips",
    desc: "Expert care tips for your motorcycle",
    route: "/premium/maintenance",
  },
];

export default function PremiumDashboard() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentMethodsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadStatus = useCallback(async () => {
    if (!headers) {
      setLoading(false);
      return;
    }
    try {
      const [premiumData, paymentsData] = await Promise.all([
        apiGet<PremiumStatus>("/api/premium/status", headers),
        apiGet<PaymentMethodsStatus>("/api/premium/payments/status", headers),
      ]);
      setStatus(premiumData);
      setPaymentStatus(paymentsData);
    } catch (e) {
      console.error("Premium status error:", e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const isPremium = status?.is_premium === true;
  const applePayReady = paymentStatus?.apple_pay_ready === true;
  const googlePayReady = paymentStatus?.google_pay_ready === true;
  const premiumUntil = status?.premium_until
    ? new Date(status.premium_until).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} data-testid="premium-back-btn">
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>MotoGO Premium</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : isPremium ? (
          <>
            {/* Active Premium Card */}
            <View style={styles.activePremiumCard} data-testid="premium-active-card">
              <View style={styles.premiumGlow} />
              <View style={styles.premiumBadgeRow}>
                <View style={styles.premiumActiveBadge}>
                  <Ionicons name="diamond" size={16} color={Colors.bg} />
                  <Text style={styles.premiumActiveBadgeText}>ACTIVE</Text>
                </View>
              </View>
              <Ionicons name="shield-checkmark" size={48} color={Colors.accent} />
              <Text style={styles.activePremiumTitle}>Premium Active</Text>
              {premiumUntil && (
                <Text style={styles.activePremiumSub}>Valid until {premiumUntil}</Text>
              )}
            </View>

            {/* Feature Cards */}
            <Text style={styles.sectionTitle}>Premium Features</Text>
            {FEATURES.map((f) => (
              <Pressable
                key={f.title}
                style={styles.featureCard}
                onPress={() => router.push(f.route as any)}
                data-testid={`premium-feature-${f.icon}`}
              >
                <View style={styles.featureIconBox}>
                  <Ionicons name={f.icon} size={24} color={Colors.accent} />
                </View>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {/* Subscribe Card */}
            <View style={styles.subscribeCard} data-testid="premium-subscribe-card">
              <View style={styles.premiumGlow} />
              <View style={styles.premiumIconWrap}>
                <Ionicons name="diamond" size={40} color={Colors.accent} />
              </View>
              <Text style={styles.subscribeTitle}>Unlock MotoGO Premium</Text>
              <Text style={styles.subscribePrice}>
                <Text style={styles.priceAmount}>{"\u20AC"}4.99</Text>
                <Text style={styles.pricePeriod}> / month</Text>
              </Text>

              <View style={styles.paymentMethodsRow}>
                <Pressable
                  style={[styles.nativePayBtn, !applePayReady && styles.nativePayBtnDisabled]}
                  disabled
                  data-testid="premium-apple-pay-btn"
                >
                  <Ionicons name="logo-apple" size={18} color={Colors.text} />
                  <Text style={styles.nativePayBtnText}>Apple Pay</Text>
                </Pressable>
                <Pressable
                  style={[styles.nativePayBtn, !googlePayReady && styles.nativePayBtnDisabled]}
                  disabled
                  data-testid="premium-google-pay-btn"
                >
                  <Ionicons name="logo-google" size={18} color={Colors.text} />
                  <Text style={styles.nativePayBtnText}>Google Pay</Text>
                </Pressable>
              </View>

              {/* Feature list */}
              <View style={styles.featureList}>
                {[
                  "Your Bike dashboard with smart alerts",
                  "Free Ride Mode with GPS tracking",
                  "Curated route recommendations",
                  "Maintenance tips & reminders",
                  "Route sharing in group chats",
                ].map((text) => (
                  <View key={text} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                    <Text style={styles.featureText}>{text}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.subscribeBtn, styles.subscribeBtnDisabled]} data-testid="premium-native-pay-status-card">
                <Ionicons name="phone-portrait" size={20} color={Colors.bg} />
                <Text style={styles.subscribeBtnText}>Native payments are being configured</Text>
              </View>

              <Text style={styles.subscribeNote}>
                {paymentStatus?.message ?? "Stripe has been removed. Apple Pay and Google Pay will activate after merchant setup."}
              </Text>
            </View>

            {/* Preview of features (locked) */}
            <Text style={styles.sectionTitle}>What you get</Text>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCardLocked} data-testid={`premium-locked-${f.icon}`}>
                <View style={styles.featureIconBox}>
                  <Ionicons name={f.icon} size={24} color={Colors.muted} />
                </View>
                <View style={styles.featureInfo}>
                  <Text style={[styles.featureTitle, { color: Colors.muted }]}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
                <Ionicons name="lock-closed" size={18} color={Colors.muted} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: Colors.accent,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
    marginTop: 8,
  },

  // Active Premium Card
  activePremiumCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: `${Colors.accent}55`,
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  premiumGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: `${Colors.accent}12`,
  },
  premiumBadgeRow: { flexDirection: "row" },
  premiumActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  premiumActiveBadgeText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_900Black",
  },
  activePremiumTitle: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Inter_900Black",
  },
  activePremiumSub: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Feature Card
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  featureCardLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    opacity: 0.6,
  },
  featureIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  featureInfo: { flex: 1, gap: 4 },
  featureTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  featureDesc: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Subscribe Card
  subscribeCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: `${Colors.accent}44`,
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  premiumIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeTitle: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Inter_900Black",
    textAlign: "center",
  },
  subscribePrice: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    color: Colors.accent,
    fontSize: 32,
    fontFamily: "Inter_900Black",
  },
  pricePeriod: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  featureList: {
    width: "100%",
    gap: 12,
    paddingTop: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  paymentMethodsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  nativePayBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nativePayBtnDisabled: {
    opacity: 0.6,
  },
  nativePayBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    marginTop: 8,
  },
  subscribeBtnDisabled: {
    opacity: 0.78,
  },
  subscribeBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  subscribeNote: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

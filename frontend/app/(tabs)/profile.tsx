import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Stats = {
  km_total: number;
  km_month: number;
  joined_routes: number;
  events_joined: number;
  completed_routes: number;
};

function Row({
  title,
  subtitle,
  leftIcon,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  leftIcon: React.ComponentProps<typeof Ionicons>["name"];
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={leftIcon} size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={Colors.muted} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { accessToken, me, logout, refreshMe } = useAuthStore();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    setError(null);
    setLoading(true);
    try {
      await refreshMe();
      const s = await apiGet<Stats>("/api/stats", headers);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [headers, refreshMe]);

  useEffect(() => {
    load();
  }, [load]);

  const motoLine = me?.bike?.model ? `${me.bike.model}${me.bike?.cc ? ` · ${me.bike.cc}cc` : ""}` : "Motorcycle not set";
  const country = me?.country ? me.country : "Country not set";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
          <Text style={styles.sub}>Account, stats & settings</Text>
        </View>

        {/* PROFILE HEADER */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={Colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{me?.username ?? ""}</Text>
            <Text style={styles.meta}>{motoLine}</Text>
            <Text style={styles.meta}>{country}</Text>
          </View>
          <Pressable onPress={() => router.push("/profile/edit")} style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color={Colors.text} />
          </Pressable>
        </View>

        {/* PERSONAL STATS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal stats</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.km_total ?? 0}</Text>
                <Text style={styles.statLabel}>Total Distance</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.km_month ?? 0}</Text>
                <Text style={styles.statLabel}>Monthly Distance</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trail-sign-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.completed_routes ?? 0}</Text>
                <Text style={styles.statLabel}>Completed Routes</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="ticket-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.events_joined ?? 0}</Text>
                <Text style={styles.statLabel}>Events Joined</Text>
              </View>
            </View>
          )}

          <Text style={styles.statsNote}>
            Kilometers are calculated automatically from completed routes only.
          </Text>
        </View>

        {/* PREMIUM */}
        <View style={styles.section}>
          <View style={styles.premiumHeader}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Moto GO Premium</Text>
            <View style={styles.premiumPill}>
              <Text style={styles.premiumPillText}>COMING SOON</Text>
            </View>
          </View>

          <View style={styles.premiumCard}>
            <Text style={styles.premiumTitle}>MotoGO Premium</Text>
            <Text style={styles.premiumSub}>Premium Features:</Text>
            {[
              "Personal Routes History (saved permanently)",
              "Advanced Riding Statistics (monthly & yearly)",
              "Detailed Ride Timeline",
              "Smart Motorcycle Notifications: service/insurance/ITP",
              "Country-based regulations",
              "Ride Data Export (PDF / CSV)",
              "Priority Support",
              "Exclusive Premium Badges",
              "Early Access to new features",
            ].map((t) => (
              <View key={t} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{t}</Text>
              </View>
            ))}

            <Pressable disabled style={styles.subscribeBtnDisabled}>
              <Text style={styles.subscribeBtnText}>Subscribe – Coming soon</Text>
            </Pressable>
          </View>
        </View>

        {/* SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile settings</Text>
          <Row
            title="Edit Profile"
            subtitle="Bio, motorcycle, country"
            leftIcon="person-outline"
            onPress={() => router.push("/profile/edit")}
          />
          <Row
            title="Privacy Settings"
            subtitle="Location visibility & routes"
            leftIcon="shield-outline"
            onPress={() => router.push("/profile/edit")}
          />
          <Row
            title="Notifications"
            subtitle="Routes, events, messages"
            leftIcon="notifications-outline"
            onPress={() => {}}
            right={<Text style={styles.lockedText}>Coming soon</Text>}
          />
        </View>

        {/* APP & LEGAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App & legal</Text>
          <Row title="Terms & Conditions" leftIcon="document-text-outline" onPress={() => router.push("/profile/legal/terms")} />
          <Row title="Privacy Policy" leftIcon="lock-closed-outline" onPress={() => router.push("/profile/legal/privacy")} />
          <Row title="About MotoGO" leftIcon="information-circle-outline" onPress={() => router.push("/profile/legal/about")} />
          <Row title="Credits & Investors" leftIcon="people-outline" onPress={() => router.push("/profile/legal/credits")} />
        </View>

        {/* SUPPORT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Row title="Help Center" leftIcon="help-circle-outline" onPress={() => {}} right={<Text style={styles.lockedText}>Coming soon</Text>} />
          <Row title="Contact Support" leftIcon="mail-outline" onPress={() => {}} right={<Text style={styles.lockedText}>Coming soon</Text>} />
          <Row title="FAQ" leftIcon="chatbubble-ellipses-outline" onPress={() => {}} right={<Text style={styles.lockedText}>Coming soon</Text>} />
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Row
            title="Log out"
            leftIcon="log-out-outline"
            onPress={async () => {
              await logout();
              router.replace("/auth/login");
            }}
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 28 },
  header: { paddingTop: 12, paddingBottom: 8, gap: 4 },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  profileCard: {
    marginTop: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  meta: { marginTop: 4, color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },

  section: { marginTop: 18, gap: 10 },
  sectionTitle: { color: Colors.text, fontSize: 13, fontFamily: "Inter_900Black" },

  center: { paddingVertical: 12, alignItems: "center" },
  errorText: { color: Colors.danger, fontSize: 12, fontFamily: "Inter_700Bold" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  statValue: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  statLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsNote: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  premiumHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  premiumPill: {
    marginLeft: "auto",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumPillText: { color: Colors.muted, fontSize: 10, fontFamily: "Inter_700Bold" },
  premiumCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  premiumTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  premiumSub: { marginTop: 10, color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "center" },
  bullet: { height: 6, width: 6, borderRadius: 3, backgroundColor: Colors.accent },
  bulletText: { flex: 1, color: Colors.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  subscribeBtnDisabled: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.65,
  },
  subscribeBtnText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_900Black" },

  row: {
    minHeight: 52,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    height: 36,
    width: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_900Black" },
  rowSubtitle: { marginTop: 2, color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lockedText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  h1: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sub: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statBox: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 110,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 6,
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});

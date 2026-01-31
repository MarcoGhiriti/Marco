import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, RideSessionOut } from "../../src/types/api";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";

type Stats = {
  km_total: number;
  km_month: number;
  joined_routes: number;
  events_joined: number;
  completed_routes: number;
};

type Friend = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

// Calculate level based on kilometers
function calculateLevel(kmTotal: number): { level: number; title: string; nextKm: number; progress: number } {
  const levels = [
    { level: 1, title: "Rookie", minKm: 0, maxKm: 100 },
    { level: 2, title: "Explorer", minKm: 100, maxKm: 500 },
    { level: 3, title: "Adventurer", minKm: 500, maxKm: 1000 },
    { level: 4, title: "Road Warrior", minKm: 1000, maxKm: 2500 },
    { level: 5, title: "Highway King", minKm: 2500, maxKm: 5000 },
    { level: 6, title: "Moto Master", minKm: 5000, maxKm: 10000 },
    { level: 7, title: "Legend", minKm: 10000, maxKm: 25000 },
    { level: 8, title: "Immortal", minKm: 25000, maxKm: 50000 },
    { level: 9, title: "God of Roads", minKm: 50000, maxKm: 100000 },
    { level: 10, title: "Mythical", minKm: 100000, maxKm: Infinity },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (kmTotal >= levels[i].minKm) {
      const current = levels[i];
      const progress = current.maxKm === Infinity 
        ? 100 
        : Math.min(100, ((kmTotal - current.minKm) / (current.maxKm - current.minKm)) * 100);
      return {
        level: current.level,
        title: current.title,
        nextKm: current.maxKm === Infinity ? 0 : current.maxKm,
        progress,
      };
    }
  }
  return { level: 1, title: "Rookie", nextKm: 100, progress: 0 };
}

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteOut[]>([]);
  const [activeRide, setActiveRide] = useState<RideSessionOut | null>(null);
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
      const [statsData, friendsData, routesData, rideData] = await Promise.all([
        apiGet<Stats>("/api/stats", headers),
        apiGet<Friend[]>("/api/friends", headers),
        apiGet<RouteOut[]>("/api/routes/my", headers),
        apiGet<RideSessionOut | null>("/api/rides/active", headers).catch(() => null),
      ]);
      setStats(statsData);
      setFriends(friendsData);
      setMyRoutes(routesData);
      setActiveRide(rideData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [headers, refreshMe]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartRide = async (routeId: string) => {
    if (!headers) return;
    try {
      const data = await apiPost<RideSessionOut>("/api/rides/start", { route_id: routeId }, headers);
      setActiveRide(data);
      Alert.alert("Ride Started!", "Your ride has begun. Drive safe!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not start ride");
    }
  };

  const handleEndRide = async () => {
    if (!headers || !activeRide) return;
    try {
      await apiPost("/api/rides/end", { session_id: activeRide.id }, headers);
      setActiveRide(null);
      Alert.alert("Ride Completed!", "Congrats! Your kilometers have been recorded.");
      load(); // Refresh to update stats and remove the route
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not end ride");
    }
  };

  const motoLine = me?.bike?.model 
    ? `${me.bike.model}${me.bike?.cc ? ` · ${me.bike.cc}cc` : ""}` 
    : "Motorcycle not set";
  const country = me?.country ? me.country : "Country not set";

  const levelInfo = calculateLevel(stats?.km_total ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
          <Text style={styles.sub}>Account, stats & settings</Text>
        </View>

        {/* PROFILE HEADER */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {me?.profile_photo_base64 ? (
                <Image
                  source={{ uri: me.profile_photo_base64 }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={22} color={Colors.text} />
              )}
            </View>
            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelInfo.level}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{me?.username ?? ""}</Text>
            <Text style={styles.levelTitle}>{levelInfo.title}</Text>
            <Text style={styles.meta}>{motoLine}</Text>
            <Text style={styles.meta}>{country}</Text>
          </View>
          <Pressable onPress={() => router.push("/profile/edit")} style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color={Colors.text} />
          </Pressable>
        </View>

        {/* LEVEL PROGRESS */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelIconBox}>
              <Ionicons name="trophy" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelCardTitle}>Level {levelInfo.level} · {levelInfo.title}</Text>
              <Text style={styles.levelCardSub}>
                {levelInfo.nextKm > 0 
                  ? `${Math.round(stats?.km_total ?? 0)} / ${levelInfo.nextKm} km to next level`
                  : "Maximum level reached!"}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${levelInfo.progress}%` }]} />
          </View>
        </View>

        {/* FRIENDS COUNTER */}
        <Pressable 
          onPress={() => router.push("/profile/friends")} 
          style={styles.friendsCard}
        >
          <View style={styles.friendsLeft}>
            <View style={styles.friendsIconBox}>
              <Ionicons name="people" size={20} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.friendsCount}>{friends.length}</Text>
              <Text style={styles.friendsLabel}>Friends</Text>
            </View>
          </View>
          <View style={styles.friendsPreview}>
            {friends.slice(0, 3).map((f, i) => (
              <View 
                key={f.id} 
                style={[
                  styles.friendMiniAvatar, 
                  { marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i }
                ]}
              >
                {f.profile_photo_base64 ? (
                  <Image source={{ uri: f.profile_photo_base64 }} style={styles.friendMiniImage} />
                ) : (
                  <Ionicons name="person" size={12} color={Colors.muted} />
                )}
              </View>
            ))}
            {friends.length > 3 && (
              <View style={[styles.friendMiniAvatar, styles.friendMoreBadge, { marginLeft: -10 }]}>
                <Text style={styles.friendMoreText}>+{friends.length - 3}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </Pressable>

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
                <Text style={styles.statValue}>{Math.round(stats?.km_total ?? 0)}</Text>
                <Text style={styles.statLabel}>Total km</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{Math.round(stats?.km_month ?? 0)}</Text>
                <Text style={styles.statLabel}>This month</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trail-sign-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.completed_routes ?? 0}</Text>
                <Text style={styles.statLabel}>Routes</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="ticket-outline" size={18} color={Colors.accent} />
                <Text style={styles.statValue}>{stats?.events_joined ?? 0}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
            </View>
          )}

          <Text style={styles.statsNote}>
            Kilometers are calculated from completed routes only.
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
              "Advanced Riding Statistics",
              "Smart Motorcycle Notifications",
              "Ride Data Export (PDF / CSV)",
              "Exclusive Premium Badges",
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
            title="Friends"
            subtitle={`${friends.length} friends · Add or message`}
            leftIcon="people-outline"
            onPress={() => router.push("/profile/friends")}
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
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_900Black",
  },
  username: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  levelTitle: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 2 },
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

  levelCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  levelCardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  levelCardSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.card2,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },

  friendsCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  friendsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsCount: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  friendsLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  friendsPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    borderWidth: 2,
    borderColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  friendMiniImage: {
    width: "100%",
    height: "100%",
  },
  friendMoreBadge: {
    backgroundColor: Colors.accent,
  },
  friendMoreText: {
    color: Colors.bg,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
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

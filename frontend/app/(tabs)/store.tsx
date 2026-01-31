import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { LeaderboardEntry, BadgeOut } from "../../src/types/api";

const LEVEL_TITLES = [
  "Rookie", "Explorer", "Adventurer", "Road Warrior", "Highway King",
  "Moto Master", "Legend", "Immortal", "God of Roads", "Mythical",
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myBadges, setMyBadges] = useState<BadgeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "badges">("leaderboard");

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    try {
      const [lb, badges] = await Promise.all([
        apiGet<LeaderboardEntry[]>("/api/leaderboard?limit=50", headers),
        apiGet<BadgeOut[]>("/api/badges", headers),
      ]);
      setLeaderboard(lb);
      setMyBadges(badges);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const myRank = leaderboard.findIndex((e) => e.user_id === me?.id) + 1;

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.user_id === me?.id;
    const isTop3 = item.rank <= 3;
    
    return (
      <View style={[styles.leaderboardItem, isMe && styles.leaderboardItemMe]}>
        <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
          {item.rank === 1 ? (
            <Ionicons name="trophy" size={16} color="#FFD700" />
          ) : item.rank === 2 ? (
            <Ionicons name="trophy" size={16} color="#C0C0C0" />
          ) : item.rank === 3 ? (
            <Ionicons name="trophy" size={16} color="#CD7F32" />
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        
        <View style={styles.avatar}>
          {item.profile_photo ? (
            <Image source={{ uri: item.profile_photo }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={18} color={Colors.muted} />
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.levelText}>
            Lvl {item.level} · {LEVEL_TITLES[item.level - 1] || "Rookie"}
          </Text>
        </View>
        
        <View style={styles.statsCol}>
          <Text style={styles.kmValue}>{Math.round(item.km_total)}</Text>
          <Text style={styles.kmLabel}>km</Text>
        </View>
        
        <View style={styles.badgesCol}>
          <Ionicons name="ribbon" size={14} color={Colors.accent} />
          <Text style={styles.badgesCount}>{item.badges_count}</Text>
        </View>
      </View>
    );
  };

  const renderBadgeItem = ({ item }: { item: BadgeOut }) => (
    <View style={styles.badgeCard}>
      <View style={styles.badgeIcon}>
        <Ionicons name={item.icon as any} size={28} color={Colors.accent} />
      </View>
      <View style={styles.badgeInfo}>
        <Text style={styles.badgeName}>{item.name}</Text>
        <Text style={styles.badgeDesc}>{item.description}</Text>
        <Text style={styles.badgeDate}>
          Earned {new Date(item.earned_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Leaderboard</Text>
          <Text style={styles.sub}>Top riders & achievements</Text>
        </View>
        {myRank > 0 && (
          <View style={styles.myRankBadge}>
            <Text style={styles.myRankText}>#{myRank}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setActiveTab("leaderboard")}
          style={[styles.tab, activeTab === "leaderboard" && styles.tabActive]}
        >
          <Ionicons
            name="podium"
            size={18}
            color={activeTab === "leaderboard" ? Colors.bg : Colors.muted}
          />
          <Text style={[styles.tabText, activeTab === "leaderboard" && styles.tabTextActive]}>
            Rankings
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("badges")}
          style={[styles.tab, activeTab === "badges" && styles.tabActive]}
        >
          <Ionicons
            name="ribbon"
            size={18}
            color={activeTab === "badges" ? Colors.bg : Colors.muted}
          />
          <Text style={[styles.tabText, activeTab === "badges" && styles.tabTextActive]}>
            My Badges ({myBadges.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.centerText}>Loading...</Text>
        </View>
      ) : activeTab === "leaderboard" ? (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.user_id}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="podium-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No riders yet</Text>
              <Text style={styles.emptyText}>
                Complete routes to appear on the leaderboard!
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={myBadges}
          keyExtractor={(item) => item.badge_type}
          renderItem={renderBadgeItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ribbon-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No badges yet</Text>
              <Text style={styles.emptyText}>
                Complete rides and achievements to earn badges!
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  myRankBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  myRankText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_900Black" },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_700Bold" },
  tabTextActive: { color: Colors.bg },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  leaderboardItemMe: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeTop: {
    backgroundColor: Colors.card2,
  },
  rankText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  userInfo: { flex: 1 },
  username: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  levelText: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statsCol: { alignItems: "center" },
  kmValue: { color: Colors.accent, fontSize: 16, fontFamily: "Inter_900Black" },
  kmLabel: { color: Colors.muted, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  badgesCol: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgesCount: { color: Colors.text, fontSize: 12, fontFamily: "Inter_700Bold" },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInfo: { flex: 1 },
  badgeName: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  badgeDesc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  badgeDate: { color: Colors.accent, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

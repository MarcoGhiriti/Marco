import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
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
import type { LeaderboardEntry, BadgeOut } from "../../src/types/api";

// All levels with their requirements
const ALL_LEVELS = [
  { level: 1, title: "Rookie", minKm: 0, maxKm: 100, icon: "bicycle" },
  { level: 2, title: "Explorer", minKm: 100, maxKm: 500, icon: "compass" },
  { level: 3, title: "Adventurer", minKm: 500, maxKm: 1000, icon: "map" },
  { level: 4, title: "Road Warrior", minKm: 1000, maxKm: 2500, icon: "navigate" },
  { level: 5, title: "Highway King", minKm: 2500, maxKm: 5000, icon: "car-sport" },
  { level: 6, title: "Moto Master", minKm: 5000, maxKm: 10000, icon: "speedometer" },
  { level: 7, title: "Legend", minKm: 10000, maxKm: 25000, icon: "star" },
  { level: 8, title: "Immortal", minKm: 25000, maxKm: 50000, icon: "flash" },
  { level: 9, title: "God of Roads", minKm: 50000, maxKm: 100000, icon: "flame" },
  { level: 10, title: "Mythical", minKm: 100000, maxKm: Infinity, icon: "trophy" },
];

// All available badges with unlock requirements
const ALL_BADGES = [
  { id: "first_ride", name: "First Ride", description: "Complete your first ride", icon: "flag", requirement: "Complete 1 ride", km: 0 },
  { id: "century", name: "Century Rider", description: "Ride 100 km total", icon: "speedometer", requirement: "Ride 100 km", km: 100 },
  { id: "explorer_500", name: "Explorer", description: "Ride 500 km total", icon: "compass", requirement: "Ride 500 km", km: 500 },
  { id: "adventurer_1k", name: "Adventurer", description: "Ride 1,000 km total", icon: "map", requirement: "Ride 1,000 km", km: 1000 },
  { id: "warrior_2500", name: "Road Warrior", description: "Ride 2,500 km total", icon: "navigate", requirement: "Ride 2,500 km", km: 2500 },
  { id: "king_5k", name: "Highway King", description: "Ride 5,000 km total", icon: "car-sport", requirement: "Ride 5,000 km", km: 5000 },
  { id: "master_10k", name: "Moto Master", description: "Ride 10,000 km total", icon: "ribbon", requirement: "Ride 10,000 km", km: 10000 },
  { id: "legend_25k", name: "Legend", description: "Ride 25,000 km total", icon: "star", requirement: "Ride 25,000 km", km: 25000 },
  { id: "social_5", name: "Social Rider", description: "Complete 5 group rides", icon: "people", requirement: "5 group rides", km: 0 },
  { id: "event_master", name: "Event Master", description: "Attend 10 events", icon: "calendar", requirement: "10 events", km: 0 },
];

const LEVEL_TITLES = [
  "Rookie", "Explorer", "Adventurer", "Road Warrior", "Highway King",
  "Moto Master", "Legend", "Immortal", "God of Roads", "Mythical",
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myBadges, setMyBadges] = useState<BadgeOut[]>([]);
  const [myKm, setMyKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "badges" | "levels">("leaderboard");

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) return;
    try {
      const [lb, badges, stats] = await Promise.all([
        apiGet<LeaderboardEntry[]>("/api/leaderboard?limit=50", headers),
        apiGet<BadgeOut[]>("/api/badges", headers),
        apiGet<{ km_total: number }>("/api/stats", headers).catch(() => ({ km_total: 0 })),
      ]);
      setLeaderboard(lb);
      setMyBadges(badges);
      setMyKm(stats.km_total || 0);
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
  const myLevel = ALL_LEVELS.find((l) => myKm >= l.minKm && myKm < l.maxKm) || ALL_LEVELS[0];

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

  const earnedBadgeIds = myBadges.map((b) => b.badge_type);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Rankings</Text>
          <Text style={styles.sub}>Leaderboard, badges & levels</Text>
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
            size={16}
            color={activeTab === "leaderboard" ? Colors.bg : Colors.muted}
          />
          <Text style={[styles.tabText, activeTab === "leaderboard" && styles.tabTextActive]}>
            Top
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("badges")}
          style={[styles.tab, activeTab === "badges" && styles.tabActive]}
        >
          <Ionicons
            name="ribbon"
            size={16}
            color={activeTab === "badges" ? Colors.bg : Colors.muted}
          />
          <Text style={[styles.tabText, activeTab === "badges" && styles.tabTextActive]}>
            Badges
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("levels")}
          style={[styles.tab, activeTab === "levels" && styles.tabActive]}
        >
          <Ionicons
            name="trophy"
            size={16}
            color={activeTab === "levels" ? Colors.bg : Colors.muted}
          />
          <Text style={[styles.tabText, activeTab === "levels" && styles.tabTextActive]}>
            Levels
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
      ) : activeTab === "badges" ? (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionTitle}>All Badges ({myBadges.length}/{ALL_BADGES.length} earned)</Text>
          {ALL_BADGES.map((badge) => {
            const earned = earnedBadgeIds.includes(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, earned && styles.badgeCardEarned]}>
                <View style={[styles.badgeIcon, earned && styles.badgeIconEarned]}>
                  <Ionicons 
                    name={badge.icon as any} 
                    size={28} 
                    color={earned ? Colors.accent : Colors.muted} 
                  />
                </View>
                <View style={styles.badgeInfo}>
                  <View style={styles.badgeHeader}>
                    <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                      {badge.name}
                    </Text>
                    {earned && (
                      <View style={styles.earnedBadge}>
                        <Ionicons name="checkmark" size={12} color={Colors.bg} />
                        <Text style={styles.earnedText}>Earned</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                  {!earned && (
                    <View style={styles.requirementRow}>
                      <Ionicons name="lock-closed" size={12} color={Colors.muted} />
                      <Text style={styles.requirementText}>{badge.requirement}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.currentLevelCard}>
            <View style={styles.currentLevelIcon}>
              <Ionicons name={myLevel.icon as any} size={32} color={Colors.accent} />
            </View>
            <View style={styles.currentLevelInfo}>
              <Text style={styles.currentLevelTitle}>Your Level</Text>
              <Text style={styles.currentLevelName}>
                Level {myLevel.level} · {myLevel.title}
              </Text>
              <Text style={styles.currentLevelKm}>
                {Math.round(myKm)} km / {myLevel.maxKm === Infinity ? "∞" : myLevel.maxKm} km
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>All Levels</Text>
          {ALL_LEVELS.map((level) => {
            const isCurrentLevel = level.level === myLevel.level;
            const isUnlocked = myKm >= level.minKm;
            return (
              <View 
                key={level.level} 
                style={[
                  styles.levelCard, 
                  isCurrentLevel && styles.levelCardCurrent,
                  !isUnlocked && styles.levelCardLocked
                ]}
              >
                <View style={[styles.levelIconBox, isCurrentLevel && styles.levelIconBoxCurrent]}>
                  <Ionicons 
                    name={level.icon as any} 
                    size={22} 
                    color={isUnlocked ? Colors.accent : Colors.muted} 
                  />
                </View>
                <View style={styles.levelInfo}>
                  <View style={styles.levelHeader}>
                    <Text style={[styles.levelName, !isUnlocked && styles.levelNameLocked]}>
                      Level {level.level} · {level.title}
                    </Text>
                    {isCurrentLevel && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>YOU</Text>
                      </View>
                    )}
                    {isUnlocked && !isCurrentLevel && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    )}
                  </View>
                  <Text style={styles.levelReq}>
                    {level.minKm === 0 
                      ? "Starting level" 
                      : `${level.minKm.toLocaleString()} - ${level.maxKm === Infinity ? "∞" : level.maxKm.toLocaleString()} km`
                    }
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
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
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
  tabText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  tabTextActive: { color: Colors.bg },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  
  // Leaderboard
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
  
  // Sections
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    marginTop: 8,
  },
  
  // Badges
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
    opacity: 0.6,
  },
  badgeCardEarned: {
    opacity: 1,
    borderColor: Colors.accent,
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
  badgeIconEarned: {
    backgroundColor: "rgba(208, 255, 0, 0.15)",
    borderColor: Colors.accent,
  },
  badgeInfo: { flex: 1 },
  badgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeName: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  badgeNameLocked: { color: Colors.muted },
  badgeDesc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  earnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  earnedText: { color: Colors.bg, fontSize: 10, fontFamily: "Inter_700Bold" },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  requirementText: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  
  // Levels
  currentLevelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  currentLevelIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(208, 255, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  currentLevelInfo: { flex: 1 },
  currentLevelTitle: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  currentLevelName: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black", marginTop: 2 },
  currentLevelKm: { color: Colors.accent, fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  levelCardCurrent: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  levelCardLocked: {
    opacity: 0.5,
  },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  levelIconBoxCurrent: {
    backgroundColor: "rgba(208, 255, 0, 0.15)",
  },
  levelInfo: { flex: 1 },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelName: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  levelNameLocked: { color: Colors.muted },
  levelReq: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  currentBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentBadgeText: { color: Colors.bg, fontSize: 10, fontFamily: "Inter_700Bold" },
  
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

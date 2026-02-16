import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut } from "../../src/types/api";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";

export default function RoutesScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"explore" | "my">("explore");

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadRoutes = useCallback(async () => {
    if (!authHeader) return;
    try {
      const [allRoutes, userRoutes] = await Promise.all([
        apiGet<RouteOut[]>("/api/routes", authHeader),
        apiGet<RouteOut[]>("/api/routes/my", authHeader),
      ]);
      setRoutes(allRoutes);
      setMyRoutes(userRoutes);
    } catch (e) {
      console.error("Failed to load routes:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRoutes();
  }, [loadRoutes]);

  const filteredRoutes = useMemo(() => {
    const sourceRoutes = activeTab === "explore" ? routes : myRoutes;
    if (!searchQuery.trim()) return sourceRoutes;
    
    const query = searchQuery.toLowerCase();
    return sourceRoutes.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.start_city?.toLowerCase().includes(query) ||
        r.end_city?.toLowerCase().includes(query)
    );
  }, [routes, myRoutes, activeTab, searchQuery]);

  const renderRoute = ({ item }: { item: RouteOut }) => {
    const isOwner = item.created_by === me?.id;
    
    return (
      <Pressable
        style={styles.routeCard}
        onPress={() => router.push(`/route/${item.id}`)}
      >
        {/* Route Mini Map */}
        <View style={styles.routeMapContainer}>
          <RouteMiniMap polyline={item.polyline} />
          
          {/* Difficulty Badge */}
          <View style={[
            styles.difficultyBadge,
            item.difficulty === "easy" && styles.difficultyEasy,
            item.difficulty === "medium" && styles.difficultyMedium,
            item.difficulty === "hard" && styles.difficultyHard,
          ]}>
            <Text style={styles.difficultyText}>
              {item.difficulty || "medium"}
            </Text>
          </View>
        </View>

        <View style={styles.routeInfo}>
          <Text style={styles.routeTitle} numberOfLines={1}>{item.title}</Text>
          
          <View style={styles.routeMetaRow}>
            <View style={styles.routeMetaItem}>
              <Ionicons name="resize-outline" size={14} color={Colors.muted} />
              <Text style={styles.routeMetaText}>
                {item.distance_km?.toFixed(1) || "?"} km
              </Text>
            </View>
            <View style={styles.routeMetaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.muted} />
              <Text style={styles.routeMetaText}>
                {item.estimated_duration_min 
                  ? `${Math.round(item.estimated_duration_min / 60)}h ${item.estimated_duration_min % 60}m`
                  : "?"}
              </Text>
            </View>
          </View>
          
          <View style={styles.routeLocationRow}>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {item.start_city || "Start"} → {item.end_city || "End"}
            </Text>
          </View>
          
          <View style={styles.routeFooter}>
            <View style={styles.routeStats}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={14} color={Colors.accent} />
                <Text style={styles.statText}>{item.participants?.length || 0}</Text>
              </View>
            </View>
            
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Your Route</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Routes</Text>
          <Text style={styles.sub}>Discover amazing rides</Text>
        </View>
        <Pressable
          style={styles.createBtn}
          onPress={() => router.push("/route/create")}
        >
          <Ionicons name="add" size={24} color={Colors.bg} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search routes..."
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "explore" && styles.tabActive]}
          onPress={() => setActiveTab("explore")}
        >
          <Ionicons 
            name="compass-outline" 
            size={18} 
            color={activeTab === "explore" ? Colors.bg : Colors.muted} 
          />
          <Text style={[styles.tabText, activeTab === "explore" && styles.tabTextActive]}>
            Explore
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "my" && styles.tabActive]}
          onPress={() => setActiveTab("my")}
        >
          <Ionicons 
            name="bookmark-outline" 
            size={18} 
            color={activeTab === "my" ? Colors.bg : Colors.muted} 
          />
          <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
            My Routes ({myRoutes.length})
          </Text>
        </Pressable>
      </View>

      {/* Routes List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading routes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRoute}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trail-sign-outline" size={64} color={Colors.muted} />
              <Text style={styles.emptyTitle}>
                {activeTab === "my" ? "No routes yet" : "No routes found"}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === "my" 
                  ? "Create your first route and share it with the community!"
                  : "Try adjusting your search or check back later."}
              </Text>
              {activeTab === "my" && (
                <Pressable
                  style={styles.createFirstBtn}
                  onPress={() => router.push("/route/create")}
                >
                  <Ionicons name="add" size={20} color={Colors.bg} />
                  <Text style={styles.createFirstBtnText}>Create Route</Text>
                </Pressable>
              )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  createBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  // Tabs
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  tabTextActive: {
    color: Colors.bg,
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  
  // Route Card
  routeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  routeImageContainer: {
    height: 140,
    backgroundColor: Colors.card2,
  },
  routeImage: {
    width: "100%",
    height: "100%",
  },
  routeImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  difficultyBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  difficultyEasy: {
    backgroundColor: "rgba(34, 197, 94, 0.9)",
  },
  difficultyMedium: {
    backgroundColor: "rgba(245, 158, 11, 0.9)",
  },
  difficultyHard: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
  },
  difficultyText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "capitalize",
  },
  routeInfo: {
    padding: 14,
    gap: 8,
  },
  routeTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  routeMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  routeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeMetaText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  routeLocationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeLocation: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  routeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  routeStats: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  ownerBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownerBadgeText: {
    color: Colors.bg,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  
  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  createFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  createFirstBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});

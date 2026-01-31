import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, StoryOwner } from "../../src/types/api";
import { RouteCard } from "../../src/components/RouteCard";
import { StoriesBar } from "../../src/components/StoriesBar";
import { StoryViewer } from "../../src/components/StoryViewer";

export default function HomeScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [stories, setStories] = useState<StoryOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Story viewer state
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyOwnerIndex, setStoryOwnerIndex] = useState(0);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadRoutes = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<RouteOut[]>("/api/routes", authHeader);
      setRoutes(data);
    } catch (e) {
      console.error("Failed to load routes:", e);
    }
  }, [authHeader]);

  const loadStories = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<StoryOwner[]>("/api/stories", authHeader);
      setStories(data);
    } catch (e) {
      console.error("Failed to load stories:", e);
    }
  }, [authHeader]);

  const load = useCallback(async () => {
    if (!authHeader) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      await Promise.all([loadRoutes(), loadStories()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader, loadRoutes, loadStories]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleAddStory = () => {
    router.push("/story/create");
  };

  const handleViewStory = (ownerIndex: number) => {
    setStoryOwnerIndex(ownerIndex);
    setStoryViewerVisible(true);
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!authHeader) return;
    try {
      await apiDelete(`/api/stories/${storyId}`, authHeader);
      // Refresh stories
      await loadStories();
      // If no more stories from current owner, close viewer
      const currentOwner = stories[storyOwnerIndex];
      if (currentOwner && currentOwner.stories.length <= 1) {
        setStoryViewerVisible(false);
      }
    } catch (e) {
      console.error("Failed to delete story:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.h1}>Moto GO</Text>
            <Text style={styles.sub}>Recommended routes</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.iconBtn}>
              <Ionicons name="search-outline" size={20} color={Colors.text} />
            </View>
            <View style={styles.iconBtn}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={Colors.text}
              />
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              tintColor={Colors.accent}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        >
          {/* Stories Bar */}
          <StoriesBar
            stories={stories}
            currentUserId={me?.id}
            onAddStory={handleAddStory}
            onViewStory={handleViewStory}
          />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading routes…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTitle}>Couldn't load routes</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : routes.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="trail-sign-outline" size={22} color={Colors.muted} />
              <Text style={styles.centerText}>No routes yet.</Text>
            </View>
          ) : (
            <View style={styles.routesList}>
              {routes.map((r) => (
                <RouteCard
                  key={r.id}
                  item={r}
                  onToggleJoin={async () => {
                    if (!authHeader) return;
                    try {
                      if (r.is_joined) {
                        await apiPost(`/api/routes/${r.id}/leave`, {}, authHeader);
                      } else {
                        await apiPost(`/api/routes/${r.id}/join`, {}, authHeader);
                      }
                      await loadRoutes();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Action failed");
                    }
                  }}
                />
              ))}
            </View>
          )}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>

      {/* Story Viewer Modal */}
      <StoryViewer
        visible={storyViewerVisible}
        stories={stories}
        initialOwnerIndex={storyOwnerIndex}
        currentUserId={me?.id}
        onClose={() => setStoryViewerVisible(false)}
        onDeleteStory={handleDeleteStory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerLeft: {
    gap: 4,
  },
  headerRight: {
    flexDirection: "row",
    gap: 10,
  },
  h1: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  sub: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: 20,
  },
  routesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  center: {
    paddingTop: 80,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    color: Colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
});

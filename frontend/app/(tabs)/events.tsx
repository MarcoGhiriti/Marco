import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { EventOut, RouteOut } from "../../src/types/api";

const TopTabs = createMaterialTopTabNavigator();

// Format date helper
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return `In ${days} days`;
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// My Events Tab - Only events user has joined
function MyEventsTab() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  const [events, setEvents] = useState<EventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadEvents = useCallback(async () => {
    if (!authHeader) return;
    try {
      // Get all events and filter to ones user has joined
      const data = await apiGet<EventOut[]>("/api/events", authHeader);
      // Filter to only events where user is a participant
      const joinedEvents = data.filter(e => e.is_joined);
      setEvents(joinedEvents);
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleLeave = async (eventId: string) => {
    if (!authHeader) return;
    try {
      await apiPost(`/api/events/${eventId}/leave`, {}, authHeader);
      loadEvents();
    } catch (e) {
      console.error("Failed to leave event:", e);
    }
  };

  const renderEvent = ({ item }: { item: EventOut }) => (
    <Pressable 
      style={styles.eventCard}
      onPress={() => router.push(`/event/${item.id}`)}
    >
      <View style={styles.eventDateBox}>
        <Text style={styles.eventDateDay}>
          {new Date(item.start_time).getDate()}
        </Text>
        <Text style={styles.eventDateMonth}>
          {new Date(item.start_time).toLocaleDateString("en", { month: "short" })}
        </Text>
      </View>
      
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.eventMetaRow}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />
          <Text style={styles.eventMeta} numberOfLines={1}>
            {item.location_name || "Location TBD"}
          </Text>
        </View>
        <View style={styles.eventMetaRow}>
          <Ionicons name="time-outline" size={14} color={Colors.muted} />
          <Text style={styles.eventMeta}>{formatDate(item.start_time)}</Text>
        </View>
        <View style={styles.eventMetaRow}>
          <Ionicons name="people-outline" size={14} color={Colors.accent} />
          <Text style={styles.eventParticipants}>{item.participants_count} going</Text>
        </View>
      </View>

      <Pressable 
        onPress={() => handleLeave(item.id)} 
        style={styles.leaveBtn}
      >
        <Ionicons name="exit-outline" size={18} color={Colors.danger} />
      </Pressable>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadEvents} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No events joined</Text>
            <Text style={styles.emptyText}>
              Browse and join events to see them here
            </Text>
            <Pressable 
              style={styles.browseBtn}
              onPress={() => router.push("/events/browse")}
            >
              <Ionicons name="search" size={18} color={Colors.bg} />
              <Text style={styles.browseBtnText}>Browse Events</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

// My Routes Tab - Only routes user has joined (not created)
function MyRoutesTab() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadRoutes = useCallback(async () => {
    if (!authHeader || !me) return;
    try {
      // Get all routes and filter to ones user has joined but not created
      const data = await apiGet<RouteOut[]>("/api/routes", authHeader);
      // Filter to only routes where user is a participant but NOT the creator
      const joinedRoutes = data.filter(r => 
        r.is_joined && r.created_by !== me.id
      );
      setRoutes(joinedRoutes);
    } catch (e) {
      console.error("Failed to load routes:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeader, me]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const handleLeave = async (routeId: string) => {
    if (!authHeader) return;
    try {
      await apiPost(`/api/routes/${routeId}/leave`, {}, authHeader);
      loadRoutes();
    } catch (e) {
      console.error("Failed to leave route:", e);
    }
  };

  const renderRoute = ({ item }: { item: RouteOut }) => (
    <Pressable 
      style={styles.routeCard}
      onPress={() => router.push(`/route/${item.id}`)}
    >
      <View style={styles.routeIconBox}>
        <Ionicons name="trail-sign" size={24} color={Colors.accent} />
      </View>
      
      <View style={styles.routeInfo}>
        <Text style={styles.routeTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.routeMetaRow}>
          <Ionicons name="navigate-outline" size={14} color={Colors.muted} />
          <Text style={styles.routeMeta}>
            {item.distance_km?.toFixed(1) || "?"} km
          </Text>
        </View>
        <View style={styles.routeMetaRow}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />
          <Text style={styles.routeMeta} numberOfLines={1}>
            {item.start_city || "Start"} → {item.end_city || "End"}
          </Text>
        </View>
        <View style={styles.routeMetaRow}>
          <Ionicons name="people-outline" size={14} color={Colors.accent} />
          <Text style={styles.routeParticipants}>
            {item.participants?.length || 0} riders
          </Text>
        </View>
      </View>

      <Pressable 
        onPress={() => handleLeave(item.id)} 
        style={styles.leaveBtn}
      >
        <Ionicons name="exit-outline" size={18} color={Colors.danger} />
      </Pressable>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadRoutes} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trail-sign-outline" size={64} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No routes joined</Text>
            <Text style={styles.emptyText}>
              Browse and join routes to see them here
            </Text>
            <Pressable 
              style={styles.browseBtn}
              onPress={() => router.push("/(tabs)/routes")}
            >
              <Ionicons name="search" size={18} color={Colors.bg} />
              <Text style={styles.browseBtnText}>Browse Routes</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

// Main Calendar Screen
export default function CalendarScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.h1}>Calendar</Text>
        <Text style={styles.sub}>Your upcoming activities</Text>
      </View>

      <TopTabs.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.bg },
          tabBarIndicatorStyle: { backgroundColor: Colors.accent },
          tabBarActiveTintColor: Colors.text,
          tabBarInactiveTintColor: Colors.muted,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 13 },
        }}
      >
        <TopTabs.Screen 
          name="Events" 
          component={MyEventsTab}
          options={{ 
            tabBarLabel: "Events",
          }}
        />
        <TopTabs.Screen 
          name="Routes" 
          component={MyRoutesTab}
          options={{ 
            tabBarLabel: "Routes",
          }}
        />
      </TopTabs.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  h1: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  
  tabContent: { flex: 1, backgroundColor: Colors.bg },
  listContent: { padding: 16, gap: 12 },
  
  // Event Card
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  eventDateBox: {
    width: 50,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  eventDateDay: {
    color: Colors.bg,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  eventDateMonth: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventMeta: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  eventParticipants: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  
  // Route Card
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  routeIconBox: {
    width: 50,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  routeInfo: {
    flex: 1,
    gap: 4,
  },
  routeTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  routeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeMeta: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  routeParticipants: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  
  // Leave Button
  leaveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Empty State
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  browseBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});

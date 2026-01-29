import React, { useCallback, useEffect, useState } from "react";
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
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import type { RouteOut } from "../../src/types/api";
import { RouteCard } from "../../src/components/RouteCard";

export default function HomeScreen() {
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<RouteOut[]>("/api/routes");
      setRoutes(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.h1}>Moto GO</Text>
            <Text style={styles.sub}>Trasee recomandate</Text>
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
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading routes…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTitle}>Couldn’t load routes</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : routes.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="trail-sign-outline" size={22} color={Colors.muted} />
              <Text style={styles.centerText}>No routes yet. Create one via API.</Text>
            </View>
          ) : (
            routes.map((r) => <RouteCard key={r.id} item={r} />)
          )}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
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

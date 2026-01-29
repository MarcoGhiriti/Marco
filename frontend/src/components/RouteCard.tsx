import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import type { RouteOut } from "../types/api";
import { RouteMiniMap } from "./RouteMiniMap";

function difficultyLabel(d: RouteOut["difficulty"]) {
  switch (d) {
    case "easy":
      return "Easy";
    case "medium":
      return "Medium";
    case "hard":
      return "Hard";
    default:
      return "Medium";
  }
}

export function RouteCard({
  item,
  onPress,
}: {
  item: RouteOut;
  onPress?: () => void;
}) {
  const meta = useMemo(() => {
    return [
      {
        icon: "time-outline" as const,
        label: `${item.duration_min} min`,
      },
      {
        icon: "navigate-outline" as const,
        label: `${item.distance_km} km`,
      },
      {
        icon: "flash-outline" as const,
        label: difficultyLabel(item.difficulty),
      },
    ];
  }, [item.duration_min, item.distance_km, item.difficulty]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.pill}>
          <Ionicons name="notifications-outline" size={16} color={Colors.muted} />
        </View>
      </View>

      <View style={styles.mapWrap}>
        <RouteMiniMap polyline={item.polyline} />
      </View>

      <Text style={styles.desc} numberOfLines={2}>
        {item.description || "Motorcycle route"}
      </Text>

      <View style={styles.metaRow}>
        {meta.map((m) => (
          <View key={m.icon} style={styles.metaItem}>
            <Ionicons name={m.icon} size={16} color={Colors.muted} />
            <Text style={styles.metaText}>{m.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.ctaPrimary}>
          <Ionicons name="checkmark-circle-outline" size={18} color={Colors.bg} />
          <Text style={styles.ctaPrimaryText}>Join</Text>
        </View>

        <View style={styles.ctaGhost}>
          <Ionicons name="share-outline" size={18} color={Colors.text} />
          <Text style={styles.ctaGhostText}>Share</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.2,
  },
  pill: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapWrap: {
    marginTop: 12,
  },
  desc: {
    marginTop: 8,
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  ctaPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaPrimaryText: {
    color: Colors.bg,
    fontWeight: "800",
    fontSize: 14,
  },
  ctaGhost: {
    width: 110,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "transparent",
  },
  ctaGhostText: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
});

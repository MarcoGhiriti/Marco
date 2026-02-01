import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, Share, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { RouteMiniMap } from "./RouteMiniMap";
import type { RouteOut } from "../types/api";

interface RouteCardProps {
  item: RouteOut;
  currentUserId?: string;
  activeRideRouteId?: string | null;
  onPress?: () => void;
  onToggleJoin: () => void;
  onStartRide?: () => void;
  onEndRide?: () => void;
}

export function RouteCard({ 
  item, 
  currentUserId,
  activeRideRouteId,
  onPress,
  onToggleJoin, 
  onStartRide,
  onEndRide,
}: RouteCardProps) {
  const diffColor = useMemo(() => {
    if (item.difficulty === "easy") return Colors.success;
    if (item.difficulty === "medium") return "#FFC107";
    return Colors.danger;
  }, [item.difficulty]);

  const startDateText = useMemo(() => {
    if (!item.start_date) return null;
    try {
      const d = new Date(item.start_date);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [item.start_date]);

  const isCreator = currentUserId && item.created_by === currentUserId;
  const hasActiveRide = activeRideRouteId === item.id;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🏍️ Check out this route on Moto GO!\n\n📍 ${item.title}\n📏 ${item.distance_km.toFixed(1)} km\n⏱️ ${item.duration_min} min\n\n${item.description || "Join me for this ride!"}`,
        title: item.title,
      });
    } catch (error) {
      Alert.alert("Error", "Could not share this route");
    }
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Mini Map */}
      <RouteMiniMap 
        polyline={item.polyline} 
        startCity={item.start_city}
        endCity={item.end_city}
      />

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.diffBadge, { backgroundColor: diffColor }]}>
            <Text style={styles.diffText}>
              {item.difficulty === "easy" ? "Easy" : item.difficulty === "medium" ? "Medium" : "Hard"}
            </Text>
          </View>
        </View>

        {/* Description */}
        {item.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={14} color={Colors.accent} />
            <Text style={styles.statText}>{item.distance_km.toFixed(1)} km</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={14} color={Colors.accent} />
            <Text style={styles.statText}>{item.duration_min} min</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={14} color={Colors.accent} />
            <Text style={styles.statText}>{item.participants_count}</Text>
          </View>
          {item.stops_count > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="flag-outline" size={14} color={Colors.accent} />
              <Text style={styles.statText}>{item.stops_count} stops</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Join/Leave Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onToggleJoin();
            }}
            style={[styles.joinBtn, item.is_joined && styles.joinBtnJoined]}
          >
            <Ionicons
              name={item.is_joined ? "checkmark-circle" : "add-circle-outline"}
              size={16}
              color={item.is_joined ? Colors.text : Colors.bg}
            />
            <Text style={[styles.joinBtnText, item.is_joined && styles.joinBtnTextJoined]}>
              {item.is_joined ? "Joined" : "Join"}
            </Text>
          </Pressable>

          {/* Start/End Ride Button (only for creator) */}
          {isCreator && item.is_joined && (
            hasActiveRide ? (
              <Pressable 
                onPress={(e) => {
                  e.stopPropagation();
                  onEndRide?.();
                }} 
                style={styles.rideBtn}
              >
                <Ionicons name="flag" size={16} color="#FFF" />
                <Text style={styles.rideBtnText}>End</Text>
              </Pressable>
            ) : !activeRideRouteId ? (
              <Pressable 
                onPress={(e) => {
                  e.stopPropagation();
                  onStartRide?.();
                }} 
                style={[styles.rideBtn, styles.startRideBtn]}
              >
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.rideBtnText}>Start</Text>
              </Pressable>
            ) : null
          )}

          {/* Share Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            style={styles.shareBtn}
          >
            <Ionicons name="share-social-outline" size={18} color={Colors.text} />
          </Pressable>

          {/* Creator Badge */}
          {isCreator && (
            <View style={styles.creatorBadge}>
              <Ionicons name="star" size={12} color={Colors.accent} />
              <Text style={styles.creatorText}>Creator</Text>
            </View>
          )}
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
    borderRadius: 20,
    overflow: "hidden",
  },
  cardContent: {
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  desc: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  joinBtnJoined: {
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtnText: {
    color: Colors.bg,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  joinBtnTextJoined: {
    color: Colors.text,
  },
  rideBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.danger,
  },
  startRideBtn: {
    backgroundColor: Colors.success,
  },
  rideBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorText: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

interface PremiumBadgeProps {
  size?: "sm" | "md" | "lg";
}

export function PremiumBadge({ size = "sm" }: PremiumBadgeProps) {
  const s = size === "lg" ? 22 : size === "md" ? 18 : 14;
  const iconSize = size === "lg" ? 13 : size === "md" ? 11 : 9;
  return (
    <View
      style={[
        styles.badge,
        { width: s, height: s, borderRadius: s / 2 },
      ]}
      data-testid="premium-badge"
    >
      <Ionicons name="bicycle" size={iconSize} color={Colors.bg} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
});

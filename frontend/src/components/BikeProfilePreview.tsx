import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../theme/colors";

type Props = {
  bikeName: string;
  plateNumber: string;
  currentKm: number;
  nextServiceKm: number | null;
  totalExpenses: number;
};

export function BikeProfilePreview({ bikeName, plateNumber, currentKm, nextServiceKm, totalExpenses }: Props) {
  return (
    <View style={styles.card} data-testid="bike-profile-preview-card">
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="bicycle" size={22} color={Colors.accent} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} data-testid="bike-profile-preview-name">{bikeName}</Text>
          <Text style={styles.subtitle} data-testid="bike-profile-preview-plate">{plateNumber}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Mileage</Text>
          <Text style={styles.statValue} data-testid="bike-profile-preview-km">{currentKm.toLocaleString()} km</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Next service</Text>
          <Text style={styles.statValue} data-testid="bike-profile-preview-service">{nextServiceKm ? `${nextServiceKm.toLocaleString()} km` : "Not set"}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Tracked costs</Text>
        <Text style={styles.footerValue} data-testid="bike-profile-preview-costs">{totalExpenses.toFixed(2)} EUR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.accent}18`,
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  subtitle: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10 },
  statChip: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  statLabel: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statValue: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footerValue: { color: Colors.accent, fontSize: 15, fontFamily: "Inter_900Black" },
});
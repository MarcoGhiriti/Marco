import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import type { RideLabel, RideScoreData, WeatherCondition } from "../hooks/useRideScore";

// ─── icon mapping ──────────────────────────────────────────────────────────────
const CONDITION_ICON: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sun: "sunny",
  cloud: "cloudy",
  rain: "rainy",
  wind: "flag",
  snow: "snow",
  storm: "thunderstorm",
};

// ─── score colour ──────────────────────────────────────────────────────────────
function scoreColor(label: RideLabel | null): string {
  if (!label) return Colors.muted;
  if (label === "GREAT" || label === "GOOD") return Colors.accent;
  if (label === "CAUTION") return Colors.warning;
  return Colors.danger;
}

// ─── detail rows ───────────────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={sheet.detailRow}>
      <View style={sheet.detailIcon}>
        <Ionicons name={icon} size={16} color={Colors.muted} />
      </View>
      <Text style={sheet.detailLabel}>{label}</Text>
      <Text style={sheet.detailValue}>{value}</Text>
    </View>
  );
}

// ─── props ─────────────────────────────────────────────────────────────────────
type Props = {
  data: RideScoreData | null;
  loading: boolean;
  isOffline: boolean;
  hasPermission: boolean;
};

// ─── main component ────────────────────────────────────────────────────────────
export function RideStatusChip({ data, loading, isOffline, hasPermission }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const disabled = !hasPermission;
  const label = data?.label ?? null;
  const color = disabled ? Colors.muted : scoreColor(label);

  // ── chip content ─────────────────────────────────────────────────────────────
  const chipContent = (
    <View
      data-testid="ride-score-chip"
      style={[
        sheet.chip,
        { borderColor: disabled ? Colors.border : color + "60" },
        !disabled && label === "GREAT" && sheet.chipGlow,
      ]}
    >
      {loading && !data ? (
        // skeleton pulse
        <View style={sheet.skeleton} />
      ) : disabled ? (
        <>
          <Ionicons name="location-outline" size={13} color={Colors.muted} />
          <Text style={[sheet.chipScore, { color: Colors.muted }]}>—</Text>
        </>
      ) : (
        <>
          <Ionicons
            name={CONDITION_ICON[data?.condition ?? "sun"]}
            size={13}
            color={color}
          />
          <Text style={[sheet.chipScore, { color: Colors.text }]}>
            {data?.score.toFixed(1)}
          </Text>
          <Text style={[sheet.chipLabel, { color }]}>
            {data?.label ?? ""}
          </Text>
          {isOffline && (
            <View style={sheet.offlineDot} />
          )}
        </>
      )}
    </View>
  );

  return (
    <>
      <Pressable
        onPress={() => {
          if (loading && !data) return; // not ready
          setSheetOpen(true);
        }}
        hitSlop={8}
        data-testid="ride-score-chip-press"
      >
        {chipContent}
      </Pressable>

      {/* ── details bottom sheet ─────────────────────────────────────────────── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={sheet.overlay} onPress={() => setSheetOpen(false)}>
          <Pressable style={sheet.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={sheet.handle} />

            {/* header */}
            <View style={sheet.sheetHeader}>
              <Text style={sheet.sheetTitle}>Ride Score</Text>
              {data && (
                <View style={[sheet.scoreBadge, { borderColor: color }]}>
                  <Text style={[sheet.scoreBig, { color }]}>{data.score.toFixed(1)}</Text>
                  <Text style={sheet.scoreOf}>/10</Text>
                </View>
              )}
            </View>

            {/* permission denied state */}
            {disabled ? (
              <View style={sheet.permissionBox}>
                <Ionicons name="location-outline" size={28} color={Colors.muted} />
                <Text style={sheet.permissionText}>
                  Enable location to get Ride Score.
                </Text>
              </View>
            ) : !data ? (
              <View style={sheet.permissionBox}>
                <Ionicons name="cloud-download-outline" size={28} color={Colors.muted} />
                <Text style={sheet.permissionText}>Fetching weather…</Text>
              </View>
            ) : (
              <>
                {/* summary row */}
                <View
                  style={[
                    sheet.summaryRow,
                    { backgroundColor: color + "15", borderColor: color + "40" },
                  ]}
                >
                  <Ionicons name={CONDITION_ICON[data.condition]} size={18} color={color} />
                  <Text style={[sheet.summaryText, { color }]}>{data.summary}</Text>
                </View>

                {/* detail rows */}
                <DetailRow
                  icon="thermometer-outline"
                  label="Temperature"
                  value={`${data.temp}°C`}
                />
                <DetailRow
                  icon="flag-outline"
                  label="Wind"
                  value={`${data.windKmh} km/h`}
                />
                <DetailRow
                  icon="umbrella-outline"
                  label="Rain probability"
                  value={`${data.rainProb}%`}
                />

                {/* score label */}
                <View style={[sheet.labelBanner, { borderColor: color + "50" }]}>
                  <Text style={[sheet.labelBannerText, { color }]}>
                    {data.label}
                  </Text>
                  <Text style={sheet.labelBannerSub}>
                    {data.label === "GREAT"
                      ? "8.5 – 10 · Perfect riding weather"
                      : data.label === "GOOD"
                      ? "7.0 – 8.4 · Enjoyable conditions"
                      : data.label === "CAUTION"
                      ? "4.0 – 6.9 · Ride carefully"
                      : "0 – 3.9 · Not recommended"}
                  </Text>
                </View>

                {isOffline && (
                  <View style={sheet.offlineBar}>
                    <Ionicons name="cloud-offline-outline" size={13} color={Colors.warning} />
                    <Text style={sheet.offlineBarText}>Showing cached data</Text>
                  </View>
                )}
              </>
            )}

            {/* disclaimer */}
            <Text style={sheet.disclaimer}>
              Conditions can change — ride responsibly.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────
const sheet = StyleSheet.create({
  // chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    gap: 5,
  },
  chipGlow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  chipScore: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  chipLabel: {
    fontSize: 10,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.5,
  },
  skeleton: {
    width: 46,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  offlineDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginLeft: 1,
  },

  // modal overlay
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 18,
  },

  // sheet header
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1.5,
    gap: 2,
  },
  scoreBig: {
    fontSize: 26,
    fontFamily: "Inter_900Black",
  },
  scoreOf: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },

  // summary
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },

  // detail rows
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  detailIcon: {
    width: 28,
    alignItems: "center",
  },
  detailLabel: {
    flex: 1,
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  detailValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // label banner
  labelBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: Colors.card2,
  },
  labelBannerText: {
    fontSize: 16,
    fontFamily: "Inter_900Black",
    letterSpacing: 1,
  },
  labelBannerSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 3,
  },

  // offline
  offlineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  offlineBarText: {
    color: Colors.warning,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // permission denied
  permissionBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  permissionText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },

  // disclaimer
  disclaimer: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 16,
    opacity: 0.7,
  },
});

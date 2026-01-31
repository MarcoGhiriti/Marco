import React from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";

export default function MapScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Live Map</Text>
            <Text style={styles.sub}>Waze-like reports</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Ionicons name="map" size={64} color={Colors.accent} />
            <Text style={styles.title}>Interactive Map</Text>
            <Text style={styles.desc}>
              The live map with real-time reports (police, hazards, accidents) works on mobile devices.
            </Text>
            <Text style={styles.descSub}>
              Download the Expo Go app and scan the QR code to use this feature on your phone.
            </Text>
          </View>

          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>Features available on mobile:</Text>
            {[
              { icon: "shield", label: "Report police checkpoints", color: "#4A90D9" },
              { icon: "warning", label: "Report road hazards", color: "#FF9500" },
              { icon: "car", label: "Report accidents", color: "#FF2D55" },
              { icon: "speedometer", label: "Report speed cameras", color: "#AF52DE" },
              { icon: "close-circle", label: "Report road closures", color: "#FF3B30" },
            ].map((item, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={16} color="#FFF" />
                </View>
                <Text style={styles.featureLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={() => router.push("/create/route")} style={styles.actionBtn}>
              <Ionicons name="trail-sign" size={20} color={Colors.bg} />
              <Text style={styles.actionBtnText}>Create Route</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/create/event")} style={styles.actionBtn}>
              <Ionicons name="calendar" size={20} color={Colors.bg} />
              <Text style={styles.actionBtnText}>Create Event</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  content: { flex: 1, padding: 16, gap: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black" },
  desc: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 20 },
  descSub: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  featuresCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  featuresTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  actionBtnText: { color: Colors.bg, fontSize: 13, fontFamily: "Inter_700Bold" },
});

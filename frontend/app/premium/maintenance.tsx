import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Tip = {
  id: string;
  title: string;
  icon: string;
  description: string;
  frequency: string;
};

export default function MaintenanceTipsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  useEffect(() => {
    if (!headers) return;
    apiGet<Tip[]>("/api/premium/maintenance-tips", headers)
      .then(setTips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [headers]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Maintenance Tips</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : (
          tips.map((tip) => (
            <View key={tip.id} style={styles.tipCard} data-testid={`tip-card-${tip.id}`}>
              <View style={styles.tipHeader}>
                <View style={styles.tipIconBox}>
                  <Ionicons name={(tip.icon || "build") as any} size={22} color={Colors.accent} />
                </View>
                <View style={styles.tipHeaderText}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipFreq}>{tip.frequency}</Text>
                </View>
              </View>
              <Text style={styles.tipDesc}>{tip.description}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  tipCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16, gap: 12,
  },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  tipIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  tipHeaderText: { flex: 1, gap: 2 },
  tipTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  tipFreq: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tipDesc: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
});

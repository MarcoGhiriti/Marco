import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";

export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Community</Text>
          <Text style={styles.sub}>Friends, groups & chat</Text>
        </View>

        <View style={styles.placeholder}>
          <Ionicons name="chatbubbles-outline" size={28} color={Colors.muted} />
          <Text style={styles.pill}>Coming soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 16 },
  header: { paddingTop: 12, paddingBottom: 8, gap: 4 },
  h1: { color: Colors.text, fontSize: 22, fontWeight: "900" },
  sub: { color: Colors.muted, fontSize: 13, fontWeight: "600" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pill: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
});

import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../../src/theme/colors";

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Terms & Conditions</Text>
        <View style={styles.btn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.p}>
          These Terms & Conditions are provided for transparency. Moto GO is a riding platform
          designed to help riders discover routes, events and community features.
        </Text>
        <Text style={styles.p}>
          1) Safety: You are responsible for riding safely and following local traffic laws.
          Moto GO does not guarantee road conditions.
        </Text>
        <Text style={styles.p}>
          2) Content: Users may create routes, events and reports. You must not post illegal,
          harmful, or misleading content.
        </Text>
        <Text style={styles.p}>
          3) Availability: The service is provided "as is" and may change over time.
        </Text>
        <Text style={styles.p}>
          4) Liability: Moto GO is not liable for accidents, damages, or losses.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  btn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  content: { padding: 16, gap: 12 },
  p: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
});

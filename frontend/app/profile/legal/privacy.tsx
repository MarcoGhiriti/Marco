import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../../src/theme/colors";

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={styles.btn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.p}>
          Moto GO aims to collect only what is needed to provide core features.
        </Text>
        <Text style={styles.p}>
          Data we may store: account email, username, profile info, joined routes/events,
          messages, and optional location visibility settings.
        </Text>
        <Text style={styles.p}>
          Location: If enabled, location is used to power map and community features.
          You can disable location visibility in privacy settings.
        </Text>
        <Text style={styles.p}>
          We do not sell your personal data.
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

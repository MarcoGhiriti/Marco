import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../../src/theme/colors";

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>About MotoGO</Text>
        <View style={styles.btn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.p}>
          MotoGO is a premium motorcycle platform built to scale.
        </Text>
        <Text style={styles.p}>
          The mission is to help riders discover routes, join events, connect with others,
          and ride smarter with trustworthy data.
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

import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Live Map</Text>
            <Text style={styles.sub}>Event markers & police reports</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Ionicons name="map" size={64} color={Colors.accent} />
          <Text style={styles.title}>Interactive Map</Text>
          <Text style={styles.desc}>Live map is available on mobile devices.</Text>
          <Text style={styles.descSub}>
            Only event markers + Report Police are shown. Open Expo Go on your phone to use it.
          </Text>
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
  card: {
    margin: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black" },
  desc: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 20,
  },
  descSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

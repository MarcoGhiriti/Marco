import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Map</Text>
          <Text style={styles.sub}>Live map (next)</Text>
        </View>

        <View style={styles.placeholder}>
          <Ionicons name="map-outline" size={28} color={Colors.muted} />
          <Text style={styles.pText}>Map integration will be added next.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  h1: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sub: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  pText: {
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
});

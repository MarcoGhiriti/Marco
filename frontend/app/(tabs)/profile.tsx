import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
          <Text style={styles.sub}>Stats & badges</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={Colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>rider</Text>
            <Text style={styles.meta}>0 km · Level 1</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </View>

        <View style={styles.grid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total km</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Luna</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Trasee</Text>
          </View>
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
  card: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statBox: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 110,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 6,
    color: Colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});

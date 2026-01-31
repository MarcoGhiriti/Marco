import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme/colors";

export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.h1}>Moto Shop</Text>
        <Text style={styles.sub}>Gear, accessories & more</Text>
      </View>

      {/* Coming Soon Content */}
      <View style={styles.content}>
        <View style={styles.comingSoonCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="storefront" size={64} color={Colors.accent} />
          </View>
          
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          
          <Text style={styles.comingSoonText}>
            We're working hard to bring you the best motorcycle gear, accessories, and exclusive merchandise.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="shirt-outline" size={24} color={Colors.accent} />
              <Text style={styles.featureText}>Moto Apparel</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="hardware-chip-outline" size={24} color={Colors.accent} />
              <Text style={styles.featureText}>Accessories</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="gift-outline" size={24} color={Colors.accent} />
              <Text style={styles.featureText}>Exclusive Items</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="ribbon-outline" size={24} color={Colors.accent} />
              <Text style={styles.featureText}>Rewards Store</Text>
            </View>
          </View>

          <View style={styles.notifyBadge}>
            <Ionicons name="notifications-outline" size={18} color={Colors.text} />
            <Text style={styles.notifyText}>You'll be notified when we launch!</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  h1: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  sub: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  comingSoonCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  comingSoonTitle: {
    color: Colors.accent,
    fontSize: 28,
    fontFamily: "Inter_900Black",
  },
  comingSoonText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
  },
  featuresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  featureItem: {
    width: "45%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  featureText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  notifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  notifyText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

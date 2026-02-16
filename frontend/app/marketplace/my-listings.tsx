import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiDelete, apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { Colors } from "../../src/theme/colors";

type ListingOut = {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  category: string;
  images: string[];
  created_at: string;
  is_active: boolean;
};

export default function MyListingsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingOut[]>([]);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadListings = useCallback(async () => {
    if (!authHeader) return;
    try {
      setLoading(true);
      const data = await apiGet<ListingOut[]>(
        "/api/marketplace/listings?mine=true",
        authHeader
      );
      setListings(data);
    } catch (e) {
      console.error("Failed to load my listings", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  const confirmDelete = (listingId: string) => {
    if (!authHeader) return;
    Alert.alert("Delete listing?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/api/marketplace/listings/${listingId}`, authHeader);
            setListings((prev) => prev.filter((item) => item.id !== listingId));
          } catch (e) {
            Alert.alert("Error", "Failed to delete listing");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ListingOut }) => (
    <Pressable
      style={styles.listingCard}
      onPress={() => router.push(`/marketplace/${item.id}`)}
    >
      <View style={styles.imageContainer}>
        {item.images?.length ? (
          <Image source={{ uri: item.images[0] }} style={styles.image} />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={28} color={Colors.muted} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Pressable
            style={styles.deleteIcon}
            onPress={() => confirmDelete(item.id)}
          >
            <Ionicons name="trash" size={18} color={Colors.danger} />
          </Pressable>
        </View>
        <Text style={styles.cardPrice}>
          {item.price.toLocaleString()} {item.currency}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={Colors.muted} />
          <Text style={styles.cardLocation}>{item.location}</Text>
        </View>
        <Text style={styles.cardDate}>
          Posted {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Listings</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={64} color={Colors.muted} />
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Create your first listing in the marketplace.</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  listingCard: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  imageContainer: {
    width: 110,
    height: 110,
    backgroundColor: Colors.card2,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  deleteIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
  },
  cardPrice: {
    color: Colors.accent,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardLocation: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  cardDate: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
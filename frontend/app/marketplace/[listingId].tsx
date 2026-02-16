import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ListingDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  location: string;
  category: string;
  brand?: string;
  model?: string;
  year?: number;
  engine_cc?: number;
  horsepower?: number;
  kilometers?: number;
  license_type?: string;
  condition: string;
  images: string[];
  seller_id: string;
  seller_username: string;
  phone?: string;
  created_at: string;
};

export default function ListingDetailScreen() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { accessToken, me } = useAuthStore();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadListing = useCallback(async () => {
    if (!authHeader || !listingId) return;
    try {
      const data = await apiGet<ListingDetail>(
        `/api/marketplace/listings/${listingId}`,
        authHeader
      );
      setListing(data);
    } catch (e) {
      console.error("Failed to load listing:", e);
      Alert.alert("Error", "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }, [authHeader, listingId]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const handleCall = () => {
    if (!listing?.phone) {
      Alert.alert("No Phone", "Seller has not provided a phone number");
      return;
    }
    Linking.openURL(`tel:${listing.phone}`);
  };

  const handleMessage = () => {
    if (!listing) return;
    // Navigate to DM with seller
    router.push(`/community/dm/${listing.seller_id}`);
  };

  const isOwner = me?.id === listing?.seller_id;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.muted} />
          <Text style={styles.errorText}>Listing not found</Text>
          <Pressable style={styles.backBtnLarge} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {listing.images && listing.images.length > 0 ? (
            <>
              <Image
                source={{ uri: listing.images[activeImageIndex] }}
                style={styles.mainImage}
                resizeMode="cover"
              />
              {listing.images.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailRow}
                >
                  {listing.images.map((img, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => setActiveImageIndex(idx)}
                      style={[
                        styles.thumbnail,
                        idx === activeImageIndex && styles.thumbnailActive,
                      ]}
                    >
                      <Image source={{ uri: img }} style={styles.thumbnailImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={64} color={Colors.muted} />
              <Text style={styles.noImageText}>No images</Text>
            </View>
          )}
        </View>

        {/* Price & Basic Info */}
        <View style={styles.priceSection}>
          <Text style={styles.price}>
            {listing.price.toLocaleString()} {listing.currency}
          </Text>
          <View style={styles.conditionBadge}>
            <Text style={styles.conditionText}>{listing.condition}</Text>
          </View>
        </View>

        <Text style={styles.title}>{listing.title}</Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color={Colors.muted} />
          <Text style={styles.locationText}>{listing.location}</Text>
        </View>

        {/* Category */}
        <View style={styles.categoryRow}>
          <Ionicons name="pricetag-outline" size={16} color={Colors.accent} />
          <Text style={styles.categoryText}>{listing.category}</Text>
        </View>

        {/* Motorcycle Details */}
        {listing.category === "motorcycle" && (
          <View style={styles.specsCard}>
            <Text style={styles.specsTitle}>Specifications</Text>
            
            <View style={styles.specsGrid}>
              {listing.brand && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Brand</Text>
                  <Text style={styles.specValue}>{listing.brand}</Text>
                </View>
              )}
              {listing.model && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Model</Text>
                  <Text style={styles.specValue}>{listing.model}</Text>
                </View>
              )}
              {listing.year && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Year</Text>
                  <Text style={styles.specValue}>{listing.year}</Text>
                </View>
              )}
              {listing.kilometers !== undefined && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Kilometers</Text>
                  <Text style={styles.specValue}>{listing.kilometers.toLocaleString()} km</Text>
                </View>
              )}
              {listing.engine_cc && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Engine</Text>
                  <Text style={styles.specValue}>{listing.engine_cc} cc</Text>
                </View>
              )}
              {listing.horsepower && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Power</Text>
                  <Text style={styles.specValue}>{listing.horsepower} HP</Text>
                </View>
              )}
              {listing.license_type && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>License</Text>
                  <Text style={styles.specValue}>{listing.license_type}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Description */}
        {listing.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        )}

        {/* Seller Info */}
        <View style={styles.sellerCard}>
          <View style={styles.sellerInfo}>
            <View style={styles.sellerAvatar}>
              <Ionicons name="person" size={24} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.sellerName}>{listing.seller_username}</Text>
              <Text style={styles.sellerLabel}>Seller</Text>
            </View>
          </View>
          <Text style={styles.postedDate}>
            Posted {new Date(listing.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Contact Buttons */}
      {!isOwner && (
        <View style={styles.contactBar}>
          <Pressable style={styles.messageBtn} onPress={handleMessage}>
            <Ionicons name="chatbubble" size={20} color={Colors.bg} />
            <Text style={styles.messageBtnText}>Message</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.callBtn, !listing.phone && styles.callBtnDisabled]} 
            onPress={handleCall}
          >
            <Ionicons name="call" size={20} color={listing.phone ? Colors.bg : Colors.muted} />
            <Text style={[styles.callBtnText, !listing.phone && styles.callBtnTextDisabled]}>
              {listing.phone ? "Call" : "No Phone"}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: Colors.muted,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  backBtnLarge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  
  // Header
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
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginHorizontal: 12,
  },
  
  // Content
  content: {
    paddingBottom: 100,
  },
  
  // Image Gallery
  imageGallery: {
    backgroundColor: Colors.card2,
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  noImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noImageText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  thumbnailRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailActive: {
    borderColor: Colors.accent,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  
  // Price Section
  priceSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  price: {
    color: Colors.accent,
    fontSize: 28,
    fontFamily: "Inter_900Black",
  },
  conditionBadge: {
    backgroundColor: Colors.card2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  conditionText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  
  title: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  locationText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryText: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  
  // Specs Card
  specsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  specsTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  specItem: {
    width: "47%",
    backgroundColor: Colors.card2,
    borderRadius: 10,
    padding: 12,
  },
  specLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  specValue: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  
  // Description
  descriptionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  descriptionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  descriptionText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  
  // Seller Card
  sellerCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerName: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sellerLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  postedDate: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  
  // Contact Bar
  contactBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  messageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
  },
  messageBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    borderRadius: 14,
  },
  callBtnDisabled: {
    backgroundColor: Colors.card,
  },
  callBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  callBtnTextDisabled: {
    color: Colors.muted,
  },
});

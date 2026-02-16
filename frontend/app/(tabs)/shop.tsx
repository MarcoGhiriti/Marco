import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { useRouter } from "expo-router";

const TopTabs = createMaterialTopTabNavigator();

// Types
type ListingOut = {
  id: string;
  title: string;
  description: string;
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
  condition?: string;
  images: string[];
  seller_id: string;
  seller_username: string;
  created_at: string;
};

const CATEGORIES = [
  { id: "motorcycle", label: "Motorcycle", icon: "bicycle" },
  { id: "accessories", label: "Accessories", icon: "construct" },
  { id: "gear", label: "Gear", icon: "shirt" },
  { id: "parts", label: "Parts", icon: "cog" },
];

const LICENSE_TYPES = ["A1", "A2", "A"];
const CONDITIONS = ["New", "Used"];

// New Tab - Coming Soon
function NewTab() {
  return (
    <View style={styles.tabContent}>
      <View style={styles.comingSoonCard}>
        <View style={styles.iconContainer}>
          <Ionicons name="storefront" size={64} color={Colors.accent} />
        </View>
        
        <Text style={styles.comingSoonTitle}>Coming Soon</Text>
        
        <Text style={styles.comingSoonText}>
          Official Moto GO shop with verified sellers, new products, and exclusive gear.
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.accent} />
            <Text style={styles.featureText}>Verified Sellers</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="pricetag" size={24} color={Colors.accent} />
            <Text style={styles.featureText}>New Products</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="gift" size={24} color={Colors.accent} />
            <Text style={styles.featureText}>Exclusive Gear</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="card" size={24} color={Colors.accent} />
            <Text style={styles.featureText}>Secure Payment</Text>
          </View>
        </View>

        <View style={styles.notifyBadge}>
          <Ionicons name="notifications-outline" size={18} color={Colors.text} />
          <Text style={styles.notifyText}>We'll notify you when we launch!</Text>
        </View>
      </View>
    </View>
  );
}

// Second Hand Tab - Marketplace
function SecondHandTab() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  
  const [listings, setListings] = useState<ListingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadListings = useCallback(async () => {
    if (!authHeader) return;
    try {
      setLoading(true);
      let url = "/api/marketplace/listings";
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (params.toString()) url += `?${params.toString()}`;
      
      const data = await apiGet<ListingOut[]>(url, authHeader);
      setListings(data);
    } catch (e) {
      console.error("Failed to load listings:", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, selectedCategory, searchQuery]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const renderListing = ({ item }: { item: ListingOut }) => (
    <Pressable 
      style={styles.listingCard}
      onPress={() => router.push(`/marketplace/${item.id}`)}
    >
      <View style={styles.listingImageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.listingImage} />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={Colors.muted} />
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.category}</Text>
        </View>
      </View>
      
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.listingPrice}>
          {item.price.toLocaleString()} {item.currency}
        </Text>
        
        {item.brand && item.model && (
          <Text style={styles.listingMeta}>
            {item.brand} {item.model} {item.year && `• ${item.year}`}
          </Text>
        )}
        
        <View style={styles.listingFooter}>
          <Pressable 
            onPress={(e) => {
              e.stopPropagation();
              if (item.seller_id) router.push(`/profile/${item.seller_id}`);
            }}
            style={styles.sellerRow}
          >
            <Ionicons name="person-circle-outline" size={14} color={Colors.accent} />
            <Text style={styles.sellerName} numberOfLines={1}>{item.seller_username}</Text>
          </Pressable>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={Colors.muted} />
            <Text style={styles.listingLocation}>{item.location}</Text>
          </View>
          {item.kilometers !== undefined && item.kilometers !== null && (
            <Text style={styles.listingKm}>{item.kilometers.toLocaleString()} km</Text>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.tabContent}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={loadListings}
            placeholder="Search listings..."
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <Pressable
          style={styles.myListingsBtn}
          onPress={() => router.push("/marketplace/my-listings")}
        >
          <Ionicons name="person" size={22} color={Colors.text} />
        </Pressable>
        <Pressable 
          style={styles.addListingBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color={Colors.bg} />
        </Pressable>
      </View>

      {/* Category Filter - Compact with icons only */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesRow}
      >
        <Pressable
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Ionicons 
            name="grid" 
            size={16} 
            color={!selectedCategory ? Colors.bg : Colors.muted} 
          />
        </Pressable>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={16} 
              color={selectedCategory === cat.id ? Colors.bg : Colors.muted} 
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Listings */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={64} color={Colors.muted} />
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Be the first to add a listing!</Text>
          <Pressable 
            style={styles.addFirstBtn}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={20} color={Colors.bg} />
            <Text style={styles.addFirstBtnText}>Add Listing</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListing}
          numColumns={2}
          columnWrapperStyle={styles.listingRow}
          contentContainerStyle={styles.listingsContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Listing Modal */}
      <CreateListingModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          loadListings();
        }}
        authHeader={authHeader}
      />
    </View>
  );
}

// Create Listing Modal Component
function CreateListingModal({
  visible,
  onClose,
  onCreated,
  authHeader,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  authHeader?: { Authorization: string };
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("motorcycle");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engineCc, setEngineCc] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [kilometers, setKilometers] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [condition, setCondition] = useState("Used");
  const [images, setImages] = useState<string[]>([]);
  const [phone, setPhone] = useState("");

  const resetForm = () => {
    setStep(1);
    setTitle("");
    setDescription("");
    setPrice("");
    setCurrency("EUR");
    setLocation("");
    setCategory("motorcycle");
    setBrand("");
    setModel("");
    setYear("");
    setEngineCc("");
    setHorsepower("");
    setKilometers("");
    setLicenseType("");
    setCondition("Used");
    setImages([]);
    setPhone("");
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      const newImages = result.assets
        .filter(a => a.base64)
        .map(a => `data:image/jpeg;base64,${a.base64}`);
      setImages([...images, ...newImages].slice(0, 10)); // Max 10 images
    }
  };

  const handleSubmit = async () => {
    if (!authHeader) return;
    if (!title.trim() || !price || !location.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    if (images.length === 0) {
      Alert.alert("Error", "Please add at least one image");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/api/marketplace/listings", {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        currency,
        location: location.trim(),
        category,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        year: year ? parseInt(year) : undefined,
        engine_cc: engineCc ? parseInt(engineCc) : undefined,
        horsepower: horsepower ? parseInt(horsepower) : undefined,
        kilometers: kilometers ? parseInt(kilometers) : undefined,
        license_type: licenseType || undefined,
        condition,
        images,
        phone: phone.trim() || undefined,
      }, authHeader);

      Alert.alert("Success", "Your listing has been created!");
      resetForm();
      onCreated();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create listing");
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = title.trim() && price && location.trim();
  const canProceedStep2 = images.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {step === 1 ? "Basic Info" : step === 2 ? "Details" : "Photos"}
            </Text>
            <Text style={styles.stepIndicator}>Step {step}/3</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {step === 1 && (
              <>
                {/* Category */}
                <Text style={styles.inputLabel}>Category *</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[styles.categoryOption, category === cat.id && styles.categoryOptionActive]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Ionicons 
                        name={cat.icon as any} 
                        size={24} 
                        color={category === cat.id ? Colors.bg : Colors.muted} 
                      />
                      <Text style={[styles.categoryOptionText, category === cat.id && styles.categoryOptionTextActive]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Title */}
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Yamaha MT-07 2020"
                  placeholderTextColor={Colors.muted}
                  style={styles.textInput}
                />

                {/* Description */}
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your item..."
                  placeholderTextColor={Colors.muted}
                  style={[styles.textInput, styles.textArea]}
                  multiline
                />

                {/* Price & Currency */}
                <View style={styles.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.inputLabel}>Price *</Text>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0"
                      placeholderTextColor={Colors.muted}
                      style={styles.textInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.inputLabel}>Currency</Text>
                    <View style={styles.currencyRow}>
                      {["EUR", "RON"].map((c) => (
                        <Pressable
                          key={c}
                          style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                          onPress={() => setCurrency(c)}
                        >
                          <Text style={[styles.currencyBtnText, currency === c && styles.currencyBtnTextActive]}>
                            {c}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Location */}
                <Text style={styles.inputLabel}>Location *</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City name"
                  placeholderTextColor={Colors.muted}
                  style={styles.textInput}
                />

                {/* Phone */}
                <Text style={styles.inputLabel}>Phone (optional)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="07xx xxx xxx"
                  placeholderTextColor={Colors.muted}
                  style={styles.textInput}
                  keyboardType="phone-pad"
                />
              </>
            )}

            {step === 2 && (
              <>
                {/* Motorcycle specific fields */}
                {category === "motorcycle" && (
                  <>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Brand</Text>
                        <TextInput
                          value={brand}
                          onChangeText={setBrand}
                          placeholder="e.g., Yamaha"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.inputLabel}>Model</Text>
                        <TextInput
                          value={model}
                          onChangeText={setModel}
                          placeholder="e.g., MT-07"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                        />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Year</Text>
                        <TextInput
                          value={year}
                          onChangeText={setYear}
                          placeholder="e.g., 2020"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.inputLabel}>Kilometers</Text>
                        <TextInput
                          value={kilometers}
                          onChangeText={setKilometers}
                          placeholder="e.g., 15000"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Engine (cc)</Text>
                        <TextInput
                          value={engineCc}
                          onChangeText={setEngineCc}
                          placeholder="e.g., 689"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.inputLabel}>Horsepower</Text>
                        <TextInput
                          value={horsepower}
                          onChangeText={setHorsepower}
                          placeholder="e.g., 74"
                          placeholderTextColor={Colors.muted}
                          style={styles.textInput}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <Text style={styles.inputLabel}>License Type Required</Text>
                    <View style={styles.optionsRow}>
                      {LICENSE_TYPES.map((lt) => (
                        <Pressable
                          key={lt}
                          style={[styles.optionBtn, licenseType === lt && styles.optionBtnActive]}
                          onPress={() => setLicenseType(lt)}
                        >
                          <Text style={[styles.optionBtnText, licenseType === lt && styles.optionBtnTextActive]}>
                            {lt}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.inputLabel}>Condition</Text>
                <View style={styles.optionsRow}>
                  {CONDITIONS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.optionBtn, condition === c && styles.optionBtnActive]}
                      onPress={() => setCondition(c)}
                    >
                      <Text style={[styles.optionBtnText, condition === c && styles.optionBtnTextActive]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.inputLabel}>Photos * (at least 1, max 10)</Text>
                
                <View style={styles.imagesGrid}>
                  {images.map((img, idx) => (
                    <View key={idx} style={styles.imagePreviewContainer}>
                      <Image source={{ uri: img }} style={styles.imagePreview} />
                      <Pressable
                        style={styles.removeImageBtn}
                        onPress={() => setImages(images.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="close-circle" size={24} color={Colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                  
                  {images.length < 10 && (
                    <Pressable style={styles.addImageBtn} onPress={handlePickImage}>
                      <Ionicons name="camera" size={32} color={Colors.accent} />
                      <Text style={styles.addImageText}>Add Photos</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.modalFooter}>
            {step > 1 && (
              <Pressable style={styles.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            )}
            
            {step < 3 ? (
              <Pressable
                style={[styles.nextBtn, !(step === 1 ? canProceedStep1 : true) && styles.nextBtnDisabled]}
                onPress={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : false}
              >
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.bg} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.submitBtn, (!canProceedStep2 || saving) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canProceedStep2 || saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.bg} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={Colors.bg} />
                    <Text style={styles.submitBtnText}>Create Listing</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// Main Shop Screen
export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.h1}>Moto Shop</Text>
        <Text style={styles.sub}>Buy & sell motorcycle gear</Text>
      </View>

      <TopTabs.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.bg },
          tabBarIndicatorStyle: { backgroundColor: Colors.accent },
          tabBarActiveTintColor: Colors.text,
          tabBarInactiveTintColor: Colors.muted,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 13 },
        }}
      >
        <TopTabs.Screen 
          name="New" 
          component={NewTab}
          options={{ tabBarLabel: "New" }}
        />
        <TopTabs.Screen 
          name="SecondHand" 
          component={SecondHandTab}
          options={{ tabBarLabel: "Second Hand" }}
        />
      </TopTabs.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  h1: { color: Colors.text, fontSize: 24, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  
  tabContent: { flex: 1, backgroundColor: Colors.bg },
  
  // Coming Soon styles
  comingSoonCard: {
    margin: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonTitle: {
    color: Colors.accent,
    fontSize: 24,
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
    gap: 10,
    marginTop: 8,
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
    padding: 12,
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
  },
  notifyText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  
  // Search & Filters
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addListingBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  myListingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  categoriesRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 6,
  },
  categoryChip: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  categoryChipText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  categoryChipTextActive: {
    color: Colors.bg,
  },
  
  // Listings
  listingsContainer: {
    padding: 12,
    paddingTop: 2,
  },
  listingRow: {
    justifyContent: "space-between",
    marginBottom: 8,
  },
  listingCard: {
    width: "48%",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  listingImageContainer: {
    aspectRatio: 1,
    backgroundColor: Colors.card2,
  },
  listingImage: {
    width: "100%",
    height: "100%",
  },
  noImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  listingInfo: {
    padding: 12,
    gap: 4,
  },
  listingTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  listingPrice: {
    color: Colors.accent,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  listingMeta: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  listingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listingLocation: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sellerName: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 100,
  },
  listingKm: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  
  // Empty state
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
  },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  addFirstBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  
  // Modal styles
  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  stepIndicator: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
  currencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: "center",
  },
  currencyBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  currencyBtnText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  currencyBtnTextActive: {
    color: Colors.bg,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  categoryOption: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  categoryOptionActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  categoryOptionText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  categoryOptionTextActive: {
    color: Colors.bg,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: "center",
  },
  optionBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  optionBtnText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  optionBtnTextActive: {
    color: Colors.bg,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imagePreviewContainer: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addImageText: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: "center",
  },
  backBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  nextBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Colors.accent,
    borderRadius: 14,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Colors.success,
    borderRadius: 14,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});

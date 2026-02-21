/**
 * PRODUCTION-READY RESPONSIVE SCREEN TEMPLATE
 * 
 * This template demonstrates a fully responsive React Native screen layout
 * that works correctly across all iPhone/Android sizes without hiding
 * buttons behind the notch, home indicator, or bottom tab bar.
 * 
 * KEY PRINCIPLES:
 * 1. Use useSafeAreaInsets() for dynamic safe area handling
 * 2. Use useBottomTabBarHeight() when inside tab navigation
 * 3. Use flex: 1 for content that should fill available space
 * 4. Use percentage-based or relative spacing (no hardcoded pixels for layout)
 * 5. Anchor floating buttons using bottom: insets.bottom + X
 * 6. Wrap scrollable content in ScrollView with proper paddingBottom
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// Theme colors (import from your theme)
const Colors = {
  bg: "#0D0D0D",
  card: "#1A1A1A",
  text: "#FFFFFF",
  muted: "#888888",
  accent: "#10B981",
  danger: "#EF4444",
  border: "#2A2A2A",
};

// Get screen dimensions for percentage-based calculations
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * TEMPLATE 1: Full Screen with Map + Floating Action Buttons
 * Use this for screens with full-screen content (maps, cameras) and floating UI
 */
export function MapScreenTemplate() {
  const insets = useSafeAreaInsets();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Dynamic bottom padding: accounts for home indicator + extra spacing
  const floatingButtonBottom = insets.bottom + 20;
  
  // Dynamic top padding for status bar area
  const headerTop = Platform.OS === "ios" ? insets.top : (StatusBar.currentHeight ?? 0);

  return (
    <View style={styles.fullScreenContainer}>
      {/* 
        MAP/CONTENT LAYER - Fills entire screen 
        Use flex: 1 to fill all available space
      */}
      <View style={styles.mapContainer}>
        {/* Your MapView or full-screen content goes here */}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Map Content (flex: 1)</Text>
        </View>
      </View>

      {/* 
        TOP OVERLAY - Search bar, back button, etc.
        Uses absolute positioning with dynamic top padding
      */}
      <View style={[styles.topOverlay, { top: headerTop + 12 }]}>
        <Pressable style={styles.backButton} data-testid="back-button">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.muted} />
          <Text style={styles.searchPlaceholder}>Search location...</Text>
        </View>
      </View>

      {/* 
        FLOATING ACTION BUTTONS - Anchored to safe area bottom
        Uses insets.bottom + offset to avoid home indicator
      */}
      <View style={[styles.floatingActions, { bottom: floatingButtonBottom }]}>
        <Pressable style={styles.fabSecondary} data-testid="recenter-button">
          <Ionicons name="locate" size={22} color={Colors.text} />
        </Pressable>
        <Pressable style={styles.fabPrimary} data-testid="add-marker-button">
          <Ionicons name="add" size={28} color={Colors.bg} />
        </Pressable>
      </View>

      {/* 
        BOTTOM SHEET/OVERLAY - Shows above floating buttons when item selected
        Also respects safe area insets
      */}
      {selectedItem && (
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Selected Item Details</Text>
          <View style={styles.bottomSheetActions}>
            <Pressable style={styles.actionButton} data-testid="sheet-action-1">
              <Text style={styles.actionButtonText}>Navigate</Text>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => setSelectedItem(null)}
              data-testid="sheet-close"
            >
              <Text style={styles.actionButtonTextSecondary}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}


/**
 * TEMPLATE 2: Scrollable List Screen with Header
 * Use this for screens with headers, scrollable content, and optional FAB
 */
export function ListScreenTemplate() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);

  // Calculate content padding to avoid tab bar
  const contentPaddingBottom = tabBarHeight + 20;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  return (
    <View style={[styles.screenContainer, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      
      {/* HEADER - Fixed at top */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Routes</Text>
        <Pressable style={styles.headerButton} data-testid="header-action">
          <Ionicons name="add-circle-outline" size={26} color={Colors.accent} />
        </Pressable>
      </View>

      {/* SCROLLABLE CONTENT - Uses remaining space with flex: 1 */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Example list items */}
        {Array.from({ length: 10 }).map((_, index) => (
          <Pressable 
            key={index} 
            style={styles.listItem}
            data-testid={`list-item-${index}`}
          >
            <View style={styles.listItemIcon}>
              <Ionicons name="trail-sign" size={24} color={Colors.accent} />
            </View>
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>Route #{index + 1}</Text>
              <Text style={styles.listItemSubtitle}>45 km • 2h 30min</Text>
            </View>
            <View style={styles.listItemActions}>
              <Pressable 
                style={styles.listItemActionBtn}
                data-testid={`edit-btn-${index}`}
              >
                <Ionicons name="create-outline" size={20} color={Colors.accent} />
              </Pressable>
              <Pressable 
                style={styles.listItemActionBtn}
                data-testid={`delete-btn-${index}`}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* FLOATING ACTION BUTTON - Above tab bar */}
      <Pressable 
        style={[styles.mainFab, { bottom: tabBarHeight + 16 }]}
        data-testid="create-route-fab"
      >
        <Ionicons name="add" size={28} color={Colors.bg} />
      </Pressable>
    </View>
  );
}


/**
 * TEMPLATE 3: Form/Input Screen with Keyboard Handling
 * Use this for screens with text inputs that need keyboard avoidance
 */
export function FormScreenTemplate() {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView 
      style={styles.fullScreenContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.screenContainer, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.closeButton} data-testid="form-close">
            <Ionicons name="close" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitleCentered}>Create Route</Text>
          <Pressable style={styles.saveButton} data-testid="form-save">
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>

        {/* SCROLLABLE FORM CONTENT */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Route Name</Text>
            <View style={styles.inputContainer}>
              {/* Use your TextInput component here */}
              <Text style={styles.inputPlaceholder}>Enter route name...</Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <Text style={styles.inputPlaceholder}>Describe your route...</Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Difficulty</Text>
            <View style={styles.optionsRow}>
              {["Easy", "Medium", "Hard"].map((level) => (
                <Pressable 
                  key={level}
                  style={styles.optionButton}
                  data-testid={`difficulty-${level.toLowerCase()}`}
                >
                  <Text style={styles.optionButtonText}>{level}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* BOTTOM ACTION - Inside ScrollView for form screens */}
          <View style={styles.formActions}>
            <Pressable style={styles.primaryButton} data-testid="submit-form">
              <Text style={styles.primaryButtonText}>Create Route</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}


/**
 * TEMPLATE 4: Detail Screen with Fixed Bottom Actions
 * Use this for detail pages with fixed action buttons at the bottom
 */
export function DetailScreenTemplate() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  
  // Total bottom offset: tab bar height + extra padding
  const bottomActionsHeight = 80;
  const contentPaddingBottom = tabBarHeight + bottomActionsHeight + 20;

  return (
    <View style={[styles.screenContainer, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      {/* HEADER */}
      <View style={styles.detailHeader}>
        <Pressable style={styles.backButton} data-testid="detail-back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Route Details</Text>
        <Pressable style={styles.moreButton} data-testid="detail-more">
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} />
        </Pressable>
      </View>

      {/* SCROLLABLE DETAIL CONTENT */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image/Map */}
        <View style={styles.heroContainer}>
          <View style={styles.heroPlaceholder}>
            <Ionicons name="map" size={48} color={Colors.muted} />
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.detailContent}>
          <Text style={styles.detailTitle}>Mountain Adventure Route</Text>
          <Text style={styles.detailSubtitle}>Created by @rider123</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={20} color={Colors.accent} />
              <Text style={styles.statValue}>45 km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={20} color={Colors.accent} />
              <Text style={styles.statValue}>2h 30m</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trending-up-outline" size={20} color={Colors.accent} />
              <Text style={styles.statValue}>850m</Text>
              <Text style={styles.statLabel}>Elevation</Text>
            </View>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              A beautiful mountain route with scenic views and challenging curves. 
              Perfect for experienced riders looking for an adventure.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM ACTIONS - Positioned above tab bar */}
      <View style={[
        styles.fixedBottomActions, 
        { 
          bottom: tabBarHeight,
          paddingBottom: Platform.OS === "ios" ? 16 : 20,
        }
      ]}>
        <Pressable style={styles.secondaryActionBtn} data-testid="detail-share">
          <Ionicons name="share-outline" size={22} color={Colors.accent} />
        </Pressable>
        <Pressable style={styles.primaryActionBtn} data-testid="detail-start-ride">
          <Ionicons name="play" size={20} color={Colors.bg} />
          <Text style={styles.primaryActionBtnText}>Start Ride</Text>
        </Pressable>
      </View>
    </View>
  );
}


// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // === BASE CONTAINERS ===
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flex: 1,
  },

  // === MAP SCREEN STYLES ===
  mapContainer: {
    ...StyleSheet.absoluteFillObject, // Fills entire screen
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  mapText: {
    color: Colors.muted,
    fontSize: 16,
  },
  topOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  searchPlaceholder: {
    color: Colors.muted,
    fontSize: 14,
  },
  floatingActions: {
    position: "absolute",
    right: 16,
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  bottomSheetTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  bottomSheetActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonTextSecondary: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  // === HEADER STYLES ===
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
  },
  headerTitleCentered: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  saveButtonText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },

  // === LIST ITEM STYLES ===
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${Colors.accent}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  listItemSubtitle: {
    color: Colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  listItemActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  // === FLOATING ACTION BUTTON ===
  mainFab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // === FORM STYLES ===
  formSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  formLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textAreaContainer: {
    minHeight: 100,
    alignItems: "flex-start",
  },
  inputPlaceholder: {
    color: Colors.muted,
    fontSize: 15,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  formActions: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: "700",
  },

  // === DETAIL SCREEN STYLES ===
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  heroContainer: {
    aspectRatio: 16 / 9, // Maintains aspect ratio across devices
    width: "100%",
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  detailSubtitle: {
    color: Colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  statItem: {
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 12,
  },
  descriptionSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  descriptionText: {
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },

  // === FIXED BOTTOM ACTIONS ===
  fixedBottomActions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  secondaryActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryActionBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: "700",
  },
});

// ============================================================================
// USAGE GUIDE
// ============================================================================
/**
 * HOW TO USE THESE TEMPLATES:
 * 
 * 1. IMPORT THE HOOKS:
 *    import { useSafeAreaInsets } from "react-native-safe-area-context";
 *    import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
 * 
 * 2. FOR SCREENS INSIDE TAB NAVIGATOR:
 *    const insets = useSafeAreaInsets();
 *    const tabBarHeight = useBottomTabBarHeight();
 *    <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}>
 * 
 * 3. FOR SCREENS OUTSIDE TAB NAVIGATOR (Modals, Stack screens):
 *    const insets = useSafeAreaInsets();
 *    <View style={{ paddingBottom: insets.bottom + 20 }}>
 * 
 * 4. FOR FLOATING BUTTONS:
 *    <Pressable style={{ position: 'absolute', bottom: insets.bottom + 20 }}>
 * 
 * 5. FOR HEADERS:
 *    <View style={{ paddingTop: Platform.OS === 'ios' ? insets.top : 0 }}>
 * 
 * 6. FOR KEYBOARD HANDLING:
 *    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
 * 
 * KEY RULES:
 * - NEVER use hardcoded bottom values like "bottom: 80"
 * - ALWAYS derive bottom padding from insets.bottom or tabBarHeight
 * - USE flex: 1 for containers that should fill remaining space
 * - USE aspectRatio for responsive media containers (images, maps, videos)
 * - WRAP long content in ScrollView with proper contentContainerStyle
 * - TEST on iPhone SE (small), iPhone 15 Pro Max (large), various Android sizes
 */

export default {
  MapScreenTemplate,
  ListScreenTemplate,
  FormScreenTemplate,
  DetailScreenTemplate,
};

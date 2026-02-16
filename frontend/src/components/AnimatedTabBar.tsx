import React, { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Colors } from "../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Tab configuration
const TAB_CONFIG = [
  { name: "home", icon: "home", label: "Home" },
  { name: "routes", icon: "trail-sign", label: "Routes" },
  { name: "map", icon: "map", label: "", isCenter: true },
  { name: "events", icon: "calendar", label: "Calendar" },
  { name: "shop", icon: "cart", label: "Shop" },
];

const TAB_COUNT = 5;
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 85 : 70;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;
const INDICATOR_WIDTH = 32;
const CENTER_BUTTON_SIZE = 58;

// Animated Tab Item Component
function AnimatedTabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
  tabConfig,
}: {
  route: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  tabConfig: typeof TAB_CONFIG[0];
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (isFocused) {
      // Animate in
      scale.value = withSpring(1.12, { damping: 12, stiffness: 200 });
      translateY.value = withSpring(-3, { damping: 12, stiffness: 200 });
      indicatorOpacity.value = withTiming(1, { duration: 200 });
      
      // Special glow for center map tab
      if (tabConfig.isCenter) {
        glowOpacity.value = withSpring(0.6, { damping: 10, stiffness: 150 });
      }
    } else {
      // Animate out
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      indicatorOpacity.value = withTiming(0, { duration: 150 });
      glowOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [isFocused]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ scale: indicatorOpacity.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.6], [0.8, 1.1], Extrapolate.CLAMP) }],
  }));

  // Center Map Tab - Special styling
  if (tabConfig.isCenter) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.centerTabContainer}
      >
        {/* Glow effect for center button */}
        <Animated.View style={[styles.centerGlow, glowAnimatedStyle]} />
        
        <Animated.View style={[styles.centerButton, iconAnimatedStyle]}>
          <Ionicons
            name={isFocused ? "map" : "map-outline"}
            size={28}
            color={Colors.bg}
          />
        </Animated.View>
      </Pressable>
    );
  }

  // Regular Tab
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
    >
      <Animated.View style={iconAnimatedStyle}>
        <Ionicons
          name={(isFocused ? tabConfig.icon : `${tabConfig.icon}-outline`) as any}
          size={24}
          color={isFocused ? Colors.accent : Colors.muted}
        />
      </Animated.View>
      
      {/* Active indicator dot */}
      <Animated.View style={[styles.indicatorDot, indicatorAnimatedStyle]} />
    </Pressable>
  );
}

// Main Custom Tab Bar Component
export function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  // Pill indicator position
  const indicatorPosition = useSharedValue(0);

  useEffect(() => {
    // Calculate position for pill indicator
    const targetPosition = state.index * TAB_WIDTH + (TAB_WIDTH - INDICATOR_WIDTH) / 2;
    indicatorPosition.value = withSpring(targetPosition, {
      damping: 18,
      stiffness: 200,
    });
  }, [state.index]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  return (
    <View style={styles.tabBar}>
      {/* Sliding pill indicator */}
      <Animated.View style={[styles.pillIndicator, pillAnimatedStyle]} />

      {/* Tab items */}
      <View style={styles.tabsContainer}>
        {state.routes.map((route, index) => {
          const tabConfig = TAB_CONFIG.find((t) => t.name === route.name);
          if (!tabConfig) return null;

          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <AnimatedTabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              tabConfig={tabConfig}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    backgroundColor: "#0A0A0A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
  },
  tabsContainer: {
    flexDirection: "row",
    height: "100%",
    alignItems: "center",
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  indicatorDot: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 8 : 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
  },
  pillIndicator: {
    position: "absolute",
    top: 6,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.accent,
  },
  centerTabContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    backgroundColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.OS === "ios" ? 15 : 5,
    // Shadow
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  centerGlow: {
    position: "absolute",
    width: CENTER_BUTTON_SIZE + 30,
    height: CENTER_BUTTON_SIZE + 30,
    borderRadius: (CENTER_BUTTON_SIZE + 30) / 2,
    backgroundColor: Colors.accent,
    opacity: 0,
    // Blur effect simulated with shadow
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
});

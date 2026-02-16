import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, Dimensions, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_COUNT = 5;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;
const INDICATOR_WIDTH = 32;
const CENTER_BUTTON_SIZE = 58;

// Animated Tab Icon Component
function AnimatedTabIcon({
  name,
  focused,
  isCenter = false,
}: {
  name: string;
  focused: boolean;
  isCenter?: boolean;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, { damping: 12, stiffness: 200 });
      translateY.value = withSpring(-4, { damping: 12, stiffness: 200 });
      indicatorOpacity.value = withTiming(1, { duration: 200 });
      if (isCenter) {
        glowOpacity.value = withSpring(0.5, { damping: 10, stiffness: 150 });
      }
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      indicatorOpacity.value = withTiming(0, { duration: 150 });
      glowOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [focused]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ scaleX: indicatorOpacity.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Center Map Button - Special styling
  if (isCenter) {
    return (
      <View style={styles.centerContainer}>
        {/* Glow effect */}
        <Animated.View style={[styles.centerGlow, glowAnimatedStyle]} />
        
        <Animated.View style={[styles.centerButton, iconAnimatedStyle]}>
          <Ionicons
            name={focused ? "map" : "map-outline"}
            size={28}
            color={Colors.bg}
          />
        </Animated.View>
      </View>
    );
  }

  // Regular Tab Icon
  return (
    <View style={styles.tabIconContainer}>
      <Animated.View style={iconAnimatedStyle}>
        <Ionicons
          name={(focused ? name : `${name}-outline`) as any}
          size={24}
          color={focused ? Colors.accent : Colors.muted}
        />
      </Animated.View>
      
      {/* Active indicator dot */}
      <Animated.View style={[styles.indicatorDot, indicatorAnimatedStyle]} />
    </View>
  );
}

export default function TabsLayout() {
  const { accessToken } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* Tab 1: Home */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="home" focused={focused} />
          ),
        }}
      />
      
      {/* Tab 2: Routes */}
      <Tabs.Screen
        name="routes"
        options={{
          title: "Routes",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="trail-sign" focused={focused} />
          ),
        }}
      />
      
      {/* Tab 3: MAP - CENTER, WHITE, SPECIAL */}
      <Tabs.Screen
        name="map"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="map" focused={focused} isCenter />
          ),
        }}
      />
      
      {/* Tab 4: Calendar */}
      <Tabs.Screen
        name="events"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="calendar" focused={focused} />
          ),
        }}
      />
      
      {/* Tab 5: Shop */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="cart" focused={focused} />
          ),
        }}
      />

      {/* Hidden tabs */}
      <Tabs.Screen
        name="community"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="store"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0A0A0A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    height: Platform.OS === "ios" ? 90 : 70,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    paddingTop: 8,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
  },
  indicatorDot: {
    position: "absolute",
    bottom: -2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 70,
    height: 70,
    marginTop: -20,
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // Shadow
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  centerGlow: {
    position: "absolute",
    width: CENTER_BUTTON_SIZE + 35,
    height: CENTER_BUTTON_SIZE + 35,
    borderRadius: (CENTER_BUTTON_SIZE + 35) / 2,
    backgroundColor: Colors.accent,
    // Blur simulation
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
});

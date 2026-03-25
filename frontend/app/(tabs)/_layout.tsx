import React, { useEffect, useRef } from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, Animated, Easing } from "react-native";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";
import { useNotifications } from "../../src/lib/notifications";

const CENTER_BUTTON_SIZE = 58;

// Animated Tab Icon Component - Using standard React Native Animated
function AnimatedTabIcon({
  name,
  focused,
  isCenter = false,
}: {
  name: string;
  focused: boolean;
  isCenter?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (focused) {
      // Scale up and move up
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 6,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: -4,
          friction: 6,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(indicatorOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Special pulse glow for center Map tab
      if (isCenter) {
        // Pulse animation - glow appears and fades
        Animated.sequence([
          // Appear
          Animated.parallel([
            Animated.timing(glowOpacity, {
              toValue: 0.7,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.spring(glowScale, {
              toValue: 1.2,
              friction: 4,
              tension: 100,
              useNativeDriver: true,
            }),
          ]),
          // Fade out slowly
          Animated.parallel([
            Animated.timing(glowOpacity, {
              toValue: 0,
              duration: 600,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowScale, {
              toValue: 0.8,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    } else {
      // Scale down and move back
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(indicatorOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, isCenter]);

  // Center Map Button - Special styling with pulse glow
  if (isCenter) {
    return (
      <View style={styles.centerContainer}>
        {/* Pulse glow effect */}
        <Animated.View 
          style={[
            styles.centerGlow, 
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }
          ]} 
        />
        
        <Animated.View 
          style={[
            styles.centerButton, 
            {
              transform: [
                { scale: scaleAnim },
                { translateY: translateYAnim },
              ],
            }
          ]}
        >
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
      <Animated.View 
        style={{
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
          ],
        }}
      >
        <Ionicons
          name={(focused ? name : `${name}-outline`) as any}
          size={24}
          color={focused ? Colors.accent : Colors.muted}
        />
      </Animated.View>
      
      {/* Active indicator dot */}
      <Animated.View 
        style={[
          styles.indicatorDot, 
          { opacity: indicatorOpacity }
        ]} 
      />
    </View>
  );
}

export default function TabsLayout() {
  const { accessToken } = useAuthStore();
  useNotifications(accessToken);

  if (!accessToken) {
    return <Redirect href="/auth/welcome" />;
  }

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
      
      {/* Tab 3: MAP - CENTER, WHITE, SPECIAL PULSE GLOW */}
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

      {/* Hidden tabs - not shown in tab bar */}
      <Tabs.Screen
        name="community"
        options={{ href: null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="store"
        options={{ href: null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, tabBarItemStyle: { display: "none" } }}
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
    width: 80,
    height: 80,
    marginTop: -25,
  },
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_SIZE / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  centerGlow: {
    position: "absolute",
    width: CENTER_BUTTON_SIZE + 40,
    height: CENTER_BUTTON_SIZE + 40,
    borderRadius: (CENTER_BUTTON_SIZE + 40) / 2,
    backgroundColor: Colors.accent,
  },
});

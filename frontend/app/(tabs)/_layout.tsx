import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";

const stylesTab = StyleSheet.create({
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // Special center map button
  mapIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  dot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: Colors.bg,
  },
});

function TabIcon({
  name,
  color,
  size,
  showDot,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  size: number;
  showDot?: boolean;
}) {
  return (
    <View style={stylesTab.iconWrap}>
      <Ionicons name={name} size={size} color={color} />
      {showDot ? <View style={stylesTab.dot} /> : null}
    </View>
  );
}

// Special center map icon - white, larger, prominent
function MapCenterIcon({ focused }: { focused: boolean }) {
  return (
    <View style={stylesTab.mapIconWrap}>
      <Ionicons 
        name={focused ? "map" : "map-outline"} 
        size={28} 
        color={Colors.bg} 
      />
    </View>
  );
}

export default function TabsLayout() {
  const { accessToken } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 25 : 10,
          paddingTop: 5,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      {/* Tab 1: Home */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon 
              name={focused ? "home" : "home-outline"} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* Tab 2: Routes */}
      <Tabs.Screen
        name="routes"
        options={{
          title: "Routes",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon 
              name={focused ? "trail-sign" : "trail-sign-outline"} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* Tab 3: MAP - CENTER, WHITE, PROMINENT */}
      <Tabs.Screen
        name="map"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => <MapCenterIcon focused={focused} />,
        }}
      />
      
      {/* Tab 4: Calendar (renamed from Events) */}
      <Tabs.Screen
        name="events"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon 
              name={focused ? "calendar" : "calendar-outline"} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* Tab 5: Shop */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon 
              name={focused ? "cart" : "cart-outline"} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />

      {/* Hidden tabs - accessible via navigation but not in tab bar */}
      <Tabs.Screen
        name="community"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          href: null, // Hide Rankings from tab bar
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Profile accessible from Home avatar
        }}
      />
    </Tabs>
  );
}

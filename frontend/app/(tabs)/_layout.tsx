import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { Colors } from "../../src/theme/colors";
import { useAuthStore } from "../../src/state/authStore";
import { useUnreadStore } from "../../src/state/unreadStore";


function TabIcon({
  name,
  color,
  size,
  showDot,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  size: number;

const stylesTab = StyleSheet.create({
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
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

  showDot?: boolean;
}) {
  return (
    <View style={stylesTab.iconWrap}>
      <Ionicons name={name} size={size} color={color} />
      {showDot ? <View style={stylesTab.dot} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  const { accessToken } = useAuthStore();
  const { hasUnread, refresh } = useUnreadStore();

  useEffect(() => {
    if (!accessToken) return;

    // Initial fetch + small polling (simple & robust)
    refresh(accessToken).catch(() => {});
    const t = setInterval(() => {
      refresh(accessToken).catch(() => {});
    }, 12000);

    return () => clearInterval(t);
  }, [accessToken, refresh]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name="chatbubbles-outline"
              size={size}
              color={color}
              showDot={hasUnread}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="podium-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          href: null, // Hide from tab bar, accessible via button on Home
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

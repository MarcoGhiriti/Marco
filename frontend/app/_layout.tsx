import React, { useEffect, useState } from "react";
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from "react-native";
import "../src/lib/i18n";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { Colors } from "../src/theme/colors";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    (async () => {
      if (loaded) {
        await SplashScreen.hideAsync();
        setReady(true);
      }
    })();
  }, [loaded]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (!ready) {
    return null;
  }

  if (showSplash) {
    return <AnimatedSplash onFinish={handleSplashFinish} />;
  }

  const androidTopInset = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0;

  return (
    <>
      <StatusBar style="light" />
      <View style={[styles.appRoot, { paddingTop: androidTopInset }]}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});

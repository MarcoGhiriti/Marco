import * as React from "react";
import { Platform } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

/**
 * Safe version of useBottomTabBarHeight that returns a fallback
 * instead of throwing when the context is not available.
 */
export function useSafeTabBarHeight(): number {
  const height = React.useContext(BottomTabBarHeightContext);
  if (height !== undefined) return height;
  // Fallback: approximate tab bar height per platform
  return Platform.OS === "ios" ? 90 : 70;
}

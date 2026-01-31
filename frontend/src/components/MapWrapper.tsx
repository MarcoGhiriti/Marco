// Platform-safe map component wrapper
import { Platform } from "react-native";

// Export null for web, actual components for native
export const MapView = Platform.OS === "web" ? null : require("react-native-maps").default;
export const Marker = Platform.OS === "web" ? null : require("react-native-maps").Marker;
export const Polyline = Platform.OS === "web" ? null : require("react-native-maps").Polyline;
export const PROVIDER_GOOGLE = Platform.OS === "web" ? null : require("react-native-maps").PROVIDER_GOOGLE;

export const isMapAvailable = Platform.OS !== "web";

import { Platform } from "react-native";

export function softShadow(
  elevation: number,
  color: string = "#000",
  opacity: number = 0.35
) {
  if (Platform.OS === "android") {
    return { elevation };
  }

  // iOS
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: elevation * 1.25,
    shadowOffset: { width: 0, height: elevation * 0.7 },
  };
}

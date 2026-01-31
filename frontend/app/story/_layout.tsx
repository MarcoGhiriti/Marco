import { Stack } from "expo-router";
import { Colors } from "../../src/theme/colors";

export default function StoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: "slide_from_bottom",
      }}
    />
  );
}

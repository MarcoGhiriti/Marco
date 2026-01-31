import { Stack } from "expo-router";
import { Colors } from "../../src/theme/colors";

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}

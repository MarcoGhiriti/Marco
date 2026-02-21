# React Native Responsive Layout Guide

## Quick Reference

### Essential Imports
```tsx
import { Platform, StatusBar, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
```

---

## 1. Safe Area Insets - The Foundation

```tsx
const insets = useSafeAreaInsets();

// insets object contains:
// - insets.top: Height of status bar / notch area
// - insets.bottom: Height of home indicator / gesture bar
// - insets.left: Left safe area (for landscape/notch)
// - insets.right: Right safe area (for landscape/notch)
```

### When to use each value:
| Inset | Use Case |
|-------|----------|
| `insets.top` | Header padding on iOS |
| `insets.bottom` | Floating buttons, fixed footers |
| `insets.left/right` | Landscape mode support |

---

## 2. Common Layout Patterns

### Pattern A: Full Screen with Floating Buttons (Maps, Cameras)
```tsx
export function MapScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {/* Full-screen content */}
      <MapView style={StyleSheet.absoluteFillObject} />
      
      {/* Floating button - anchored to safe area */}
      <Pressable 
        style={{
          position: "absolute",
          right: 16,
          bottom: insets.bottom + 20, // ✅ Dynamic
        }}
      >
        <Icon name="locate" />
      </Pressable>
    </View>
  );
}
```

### Pattern B: List Screen Inside Tab Navigator
```tsx
export function ListScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight(); // ← Use this for tab screens

  return (
    <View style={{ 
      flex: 1,
      paddingTop: Platform.OS === "ios" ? insets.top : 0 
    }}>
      <Header />
      <ScrollView
        contentContainerStyle={{ 
          paddingBottom: tabBarHeight + 20 // ✅ Content won't hide behind tabs
        }}
      >
        {/* List items */}
      </ScrollView>
      
      {/* FAB positioned above tab bar */}
      <Pressable style={{
        position: "absolute",
        right: 16,
        bottom: tabBarHeight + 16, // ✅ Above tab bar
      }}>
        <Icon name="add" />
      </Pressable>
    </View>
  );
}
```

### Pattern C: Modal/Stack Screen (No Tab Bar)
```tsx
export function ModalScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ 
      flex: 1,
      paddingTop: Platform.OS === "ios" ? insets.top : 0
    }}>
      <ScrollView
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 20 // ← Use insets directly
        }}
      >
        {/* Content */}
      </ScrollView>
    </View>
  );
}
```

---

## 3. Platform-Specific Top Padding

```tsx
// Inside Tab Navigator (has its own header handling)
<View style={{ 
  paddingTop: Platform.OS === "ios" ? insets.top : 0 
}}>

// In Root Layout (Android needs StatusBar height)
const androidTopInset = Platform.OS === "android" 
  ? (StatusBar.currentHeight ?? 0) 
  : 0;

<View style={{ paddingTop: androidTopInset }}>
```

---

## 4. Fixed Bottom Actions

```tsx
export function DetailScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  
  const BOTTOM_ACTIONS_HEIGHT = 80;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ 
          // Reserve space for fixed actions + tab bar
          paddingBottom: tabBarHeight + BOTTOM_ACTIONS_HEIGHT + 20
        }}
      >
        {/* Content */}
      </ScrollView>
      
      {/* Fixed footer */}
      <View style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: tabBarHeight,
        paddingBottom: Platform.OS === "ios" ? 16 : 20,
        paddingTop: 16,
        paddingHorizontal: 16,
        backgroundColor: "#0D0D0D",
        borderTopWidth: 1,
        borderTopColor: "#2A2A2A",
      }}>
        <Button title="Start Ride" />
      </View>
    </View>
  );
}
```

---

## 5. Responsive Sizing

### ❌ DON'T: Hardcoded pixels
```tsx
// Bad - will break on different devices
<View style={{ height: 80, bottom: 90 }} />
```

### ✅ DO: Dynamic values
```tsx
// Good - adapts to device
<View style={{ 
  height: "auto",
  paddingVertical: 16,
  bottom: insets.bottom + 20 
}} />
```

### Responsive Media (Images, Maps)
```tsx
// Use aspectRatio instead of fixed height
<View style={{ 
  width: "100%",
  aspectRatio: 16 / 9 // Maintains ratio on all screens
}}>
  <Image style={{ flex: 1 }} />
</View>
```

---

## 6. Keyboard Handling for Forms

```tsx
import { KeyboardAvoidingView, Platform } from "react-native";

<KeyboardAvoidingView 
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    <TextInput />
    <TextInput />
    <Button />
  </ScrollView>
</KeyboardAvoidingView>
```

---

## 7. Quick Checklist

Before shipping any screen, verify:

- [ ] `useSafeAreaInsets()` is used for dynamic spacing
- [ ] Floating buttons use `bottom: insets.bottom + X` or `bottom: tabBarHeight + X`
- [ ] ScrollView has `contentContainerStyle={{ paddingBottom: ... }}`
- [ ] No hardcoded `bottom: 80` or similar pixel values
- [ ] Tested on iPhone SE (small) and iPhone 15 Pro Max (large)
- [ ] Tested on Android with gesture navigation enabled
- [ ] Forms use `KeyboardAvoidingView`
- [ ] `data-testid` added to all interactive elements

---

## 8. Device-Specific Values Reference

| Device | insets.top | insets.bottom |
|--------|-----------|---------------|
| iPhone SE | 20 | 0 |
| iPhone 14 | 59 | 34 |
| iPhone 15 Pro Max | 59 | 34 |
| Android (no notch) | 0 | 0 |
| Android (with gesture) | 0 | 24-48 |

> **Note:** Never hardcode these values. Always use `useSafeAreaInsets()`.

---

## 9. Common Mistakes & Fixes

### Mistake 1: Using `SafeAreaView` incorrectly
```tsx
// ❌ Bad - doesn't give you control
<SafeAreaView style={{ flex: 1 }}>
  <Content />
</SafeAreaView>

// ✅ Good - full control with insets
<View style={{ flex: 1, paddingTop: insets.top }}>
  <Content />
</View>
```

### Mistake 2: Fixed positioning without insets
```tsx
// ❌ Bad - button hidden behind home indicator
<Pressable style={{ position: "absolute", bottom: 20 }}>

// ✅ Good - respects home indicator
<Pressable style={{ position: "absolute", bottom: insets.bottom + 20 }}>
```

### Mistake 3: Forgetting tab bar in FlatList
```tsx
// ❌ Bad - last items hidden behind tab bar
<FlatList data={items} />

// ✅ Good - accounts for tab bar
<FlatList 
  data={items}
  contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
/>
```

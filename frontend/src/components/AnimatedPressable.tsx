import React, { useCallback } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);

  const handlePressIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
    (e) => {
      s.value = withTiming(0.985, { duration: 120 });
      onPressIn?.(e);
    },
    [onPressIn, s]
  );

  const handlePressOut = useCallback<NonNullable<PressableProps["onPressOut"]>>(
    (e) => {
      s.value = withTiming(1, { duration: 160 });
      onPressOut?.(e);
    },
    [onPressOut, s]
  );

  const aStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: s.value }],
    };
  });

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, aStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}

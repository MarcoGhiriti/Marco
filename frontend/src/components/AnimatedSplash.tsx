import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sequence of animations
    Animated.sequence([
      // 1. Logo appears with spring bounce
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      
      // 2. Text slides in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      
      // 3. Subtitle fades in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      
      // 4. Pulse effect
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      
      // 5. Wait a bit
      Animated.delay(500),
      
      // 6. Fade out everything
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, []);

  const rotateInterpolate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-30deg", "0deg"],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Background gradient effect */}
      <View style={styles.gradientOverlay} />
      
      {/* Decorative circles */}
      <View style={[styles.decorativeCircle, styles.circle1]} />
      <View style={[styles.decorativeCircle, styles.circle2]} />
      <View style={[styles.decorativeCircle, styles.circle3]} />
      
      {/* Logo container */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: Animated.multiply(logoScale, pulseAnim) },
              { rotate: rotateInterpolate },
            ],
          },
        ]}
      >
        <View style={styles.logoInner}>
          <Ionicons name="bicycle" size={64} color={Colors.bg} />
        </View>
        {/* Glow effect */}
        <View style={styles.logoGlow} />
      </Animated.View>

      {/* App name */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslate }],
          },
        ]}
      >
        <Text style={styles.logoText}>
          <Text style={styles.logoTextMoto}>Moto</Text>
          <Text style={styles.logoTextGo}> GO</Text>
        </Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={{ opacity: subtitleOpacity }}>
        <Text style={styles.subtitle}>Ride Together, Track Your Journey</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.loadingContainer}>
        <LoadingDots />
      </View>
    </Animated.View>
  );
}

// Loading dots component
function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]).start();
  }, []);

  return (
    <View style={styles.dotsContainer}>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [
                {
                  scale: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bg,
  },
  decorativeCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: Colors.accent,
    opacity: 0.05,
  },
  circle1: {
    width: width * 1.5,
    height: width * 1.5,
    top: -width * 0.5,
    left: -width * 0.25,
  },
  circle2: {
    width: width * 0.8,
    height: width * 0.8,
    bottom: -width * 0.2,
    right: -width * 0.2,
  },
  circle3: {
    width: width * 0.4,
    height: width * 0.4,
    top: height * 0.3,
    right: -width * 0.1,
    opacity: 0.08,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoInner: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  logoGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    opacity: 0.2,
    top: -10,
    left: -10,
  },
  textContainer: {
    marginBottom: 8,
  },
  logoText: {
    fontSize: 42,
  },
  logoTextMoto: {
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  logoTextGo: {
    color: Colors.accent,
    fontFamily: "Inter_900Black",
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  loadingContainer: {
    position: "absolute",
    bottom: 80,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});

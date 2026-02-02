import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import type { StoryOwner } from "../types/api";

interface StoriesBarProps {
  stories: StoryOwner[];
  currentUserId?: string;
  onAddStory: () => void;
  onViewStory: (ownerIndex: number) => void;
}

export function StoriesBar({
  stories,
  currentUserId,
  onAddStory,
  onViewStory,
}: StoriesBarProps) {
  const ownIndex = stories.findIndex((s) => s.user_id === currentUserId);
  const hasOwnStory = ownIndex >= 0;
  const ownStory = hasOwnStory ? stories[ownIndex] : undefined;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* My Story (Instagram-like): open story if exists, plus badge to add */}
        <View style={styles.storyItem}>
          <Pressable
            onPress={() => {
              if (hasOwnStory) onViewStory(ownIndex);
              else onAddStory();
            }}
            style={styles.myStoryPressable}
          >
            <View style={styles.addCircle}>
              {ownStory?.profile_photo ? (
                <Image source={{ uri: ownStory.profile_photo }} style={styles.avatar} />
              ) : (
                <Ionicons name="person" size={24} color={Colors.muted} />
              )}
              <Pressable onPress={onAddStory} style={styles.plusBadge} hitSlop={8}>
                <Ionicons name="add" size={14} color={Colors.bg} />
              </Pressable>
            </View>
          </Pressable>

          <Text style={styles.username} numberOfLines={1}>
            Your story
          </Text>
        </View>

        {/* Friends' Stories */}
        {stories
          .filter((owner) => owner.user_id !== currentUserId)
          .map((owner, index) => {
            // Find actual index including self
            const actualIndex = stories.findIndex(
              (s) => s.user_id === owner.user_id
            );
            return (
              <Pressable
                key={owner.user_id}
                onPress={() => onViewStory(actualIndex)}
                style={styles.storyItem}
              >
                <LinearGradient
                  colors={[Colors.accent, Colors.accent2]}
                  style={styles.gradientRing}
                >
                  <View style={styles.storyCircle}>
                    {owner.profile_photo ? (
                      <Image
                        source={{ uri: owner.profile_photo }}
                        style={styles.avatar}
                      />
                    ) : (
                      <Ionicons name="person" size={24} color={Colors.muted} />
                    )}
                  </View>
                </LinearGradient>
                <Text style={styles.username} numberOfLines={1}>
                  {owner.username}
                </Text>
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    paddingHorizontal: 12,
    gap: 12,
  },
  storyItem: {
    alignItems: "center",
    width: 72,
  },
  myStoryPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  addCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  plusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 24,
    padding: 3,
  },
  storyCircle: {
    flex: 1,
    borderRadius: 21,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  username: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.muted,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

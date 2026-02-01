import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { Colors } from "../theme/colors";
import { apiGet, apiPost } from "../lib/api";
import { useAuthStore } from "../state/authStore";
import type { StoryOwner, StoryViewsOut } from "../types/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORY_DURATION = 5000; // 5 seconds per story

interface StoryViewerProps {
  visible: boolean;
  stories: StoryOwner[];
  initialOwnerIndex: number;
  currentUserId?: string;
  onClose: () => void;
  onDeleteStory?: (storyId: string) => void;
}

export function StoryViewer({
  visible,
  stories,
  initialOwnerIndex,
  currentUserId,
  onClose,
  onDeleteStory,
}: StoryViewerProps) {
  const { accessToken } = useAuthStore();

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);
  const [ownerIndex, setOwnerIndex] = useState(initialOwnerIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const currentOwner = stories[ownerIndex];
  const currentStory = currentOwner?.stories[storyIndex];
  const isOwnStory = currentOwner?.user_id === currentUserId;
  const [viewsCount, setViewsCount] = useState<number>(0);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [viewers, setViewers] = useState<Array<{ user_id: string; username: string; profile_photo?: string | null }>>([]);
  const [loadingViews, setLoadingViews] = useState(false);


  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setOwnerIndex(initialOwnerIndex);
      setStoryIndex(0);
    }
  }, [visible, initialOwnerIndex]);

  // Progress animation
  const startProgress = useCallback(() => {
    progressAnim.setValue(0);
    animationRef.current?.stop();
    
    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        goNext();
      }
    });
  }, [progressAnim]);

  useEffect(() => {
    if (visible && currentStory) {
      startProgress();
    }
    return () => {
      animationRef.current?.stop();
    };
  }, [visible, ownerIndex, storyIndex, currentStory]);

  const markViewed = useCallback(async () => {
    if (!authHeader || !currentStory) return;
    // Only mark if not your own story
    if (isOwnStory) return;
    try {
      await apiPost(`/api/stories/${currentStory.id}/view`, {}, authHeader);
    } catch (e) {
      // silent
    }
  }, [authHeader, currentStory, isOwnStory]);

  const loadViews = useCallback(async () => {
    if (!authHeader || !currentStory) return;
    if (!isOwnStory) return;
    try {
      setLoadingViews(true);
      const data = await apiGet<StoryViewsOut>(`/api/stories/${currentStory.id}/views`, authHeader);
      setViewsCount(data.views_count);
      setViewers(data.viewers.map(v => ({ user_id: v.user_id, username: v.username, profile_photo: v.profile_photo })));
    } catch (e) {
      // silent

  // Mark view and (if own story) refresh analytics on each story change
  useEffect(() => {
    if (!visible || !currentStory) return;
    markViewed();
    loadViews();
  }, [visible, ownerIndex, storyIndex, currentStory?.id, markViewed, loadViews]);

    } finally {
      setLoadingViews(false);
    }
  }, [authHeader, currentStory, isOwnStory]);


  const goNext = () => {
    if (!currentOwner) return;

    if (storyIndex < currentOwner.stories.length - 1) {
      // Next story from same owner
      setStoryIndex(storyIndex + 1);
    } else if (ownerIndex < stories.length - 1) {
      // Next owner
      setOwnerIndex(ownerIndex + 1);
      setStoryIndex(0);
    } else {
      // End of all stories
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      // Previous story from same owner
      setStoryIndex(storyIndex - 1);
    } else if (ownerIndex > 0) {
      // Previous owner
      const prevOwner = stories[ownerIndex - 1];
      setOwnerIndex(ownerIndex - 1);
      setStoryIndex(prevOwner.stories.length - 1);
    }
  };

  const handlePress = (side: "left" | "right") => {
    animationRef.current?.stop();
    if (side === "left") {
      goPrev();
    } else {
      goNext();
    }
  };

  if (!currentOwner || !currentStory) {
    return null;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Progress bars */}
        <View style={styles.progressContainer}>
          {currentOwner.stories.map((_, idx) => (
            <View key={idx} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width:
                      idx < storyIndex
                        ? "100%"
                        : idx === storyIndex
                        ? progressWidth
                        : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.ownerInfo}>
            <View style={styles.ownerAvatar}>
              {currentOwner.profile_photo ? (
                <Image
                  source={{ uri: currentOwner.profile_photo }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={18} color={Colors.text} />
              )}
            </View>
            <View style={styles.ownerText}>
              <Text style={styles.ownerName}>{currentOwner.username}</Text>
              <Text style={styles.timeAgo}>
                {getTimeAgo(currentStory.created_at)}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {isOwnStory && onDeleteStory && (
              <Pressable
                onPress={() => onDeleteStory(currentStory.id)}
                style={styles.actionBtn}
              >
                <Ionicons name="trash-outline" size={22} color={Colors.danger} />
              </Pressable>
            )}
            <Pressable onPress={onClose} style={styles.actionBtn}>
              <Ionicons name="close" size={26} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Story Content */}
        <View style={styles.storyContent}>
          {currentStory.media_type === "video" ? (
            <Video
              source={{ uri: currentStory.media_base64 }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping={false}
              isMuted={false}
            />
          ) : (
            <Image
              source={{ uri: currentStory.media_base64 }}
              style={styles.media}
              resizeMode="cover"
            />
          )}

          {/* Touch areas */}
          <Pressable
            onPress={() => handlePress("left")}
            style={styles.touchLeft}
          />
          <Pressable
            onPress={() => handlePress("right")}
            style={styles.touchRight}
          />
        </View>

        {/* Caption */}
        {currentStory.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{currentStory.caption}</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return "1d ago";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.text,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  ownerText: {
    gap: 2,
  },
  ownerName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  timeAgo: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    padding: 8,
  },
  storyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  touchLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "30%",
  },
  touchRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "70%",
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  caption: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

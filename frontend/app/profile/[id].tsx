import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type UserProfile = {
  id: string;
  username: string;
  email?: string;
  avatar?: string | null;
  level?: number;
  km_tracked?: number;
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const isOwnProfile = me?.id === id;

  useEffect(() => {
    loadUser();
    checkFriendship();
  }, [id]);

  const loadUser = async () => {
    if (!headers || !id) return;
    setLoading(true);
    try {
      const userData = await apiGet<UserProfile>(`/api/users/${id}`, headers);
      setUser(userData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading profile");
    } finally {
      setLoading(false);
    }
  };

  const checkFriendship = async () => {
    if (!headers || !id) return;
    try {
      const friends = await apiGet<{ id: string }[]>("/api/friends", headers);
      setIsFriend(friends.some((f) => f.id === id));
    } catch (e) {
      console.log("Error checking friendship", e);
    }
  };

  const sendFriendRequest = async () => {
    if (!headers || !user) return;
    setSendingRequest(true);
    try {
      await apiPost("/api/friends/request", { username: user.username }, headers);
      setRequestSent(true);
      Alert.alert("Success", `Friend request sent to ${user.username}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not send request");
    } finally {
      setSendingRequest(false);
    }
  };

  const openChat = () => {
    if (!id) return;
    router.push(`/community/dm/${id}`);
  };

  const getLevelInfo = (level: number) => {
    const levels = [
      { name: "Newbie", minKm: 0 },
      { name: "Beginner", minKm: 100 },
      { name: "Rider", minKm: 500 },
      { name: "Explorer", minKm: 1000 },
      { name: "Adventurer", minKm: 2500 },
      { name: "Veteran", minKm: 5000 },
      { name: "Expert", minKm: 10000 },
      { name: "Master", minKm: 20000 },
      { name: "Legend", minKm: 50000 },
      { name: "Ultimate", minKm: 100000 },
    ];
    return levels[Math.min(level || 0, levels.length - 1)];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error || "User not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const levelInfo = getLevelInfo(user.level || 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user.avatar ? (
              <Image
                source={{
                  uri: user.avatar.startsWith("data:")
                    ? user.avatar
                    : `data:image/jpeg;base64,${user.avatar}`,
                }}
                style={styles.avatar}
              />
            ) : (
              <Ionicons name="person" size={48} color={Colors.muted} />
            )}
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <View style={styles.levelBadge}>
            <Ionicons name="star" size={14} color={Colors.accent} />
            <Text style={styles.levelText}>
              Level {user.level || 0} • {levelInfo.name}
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{(user.km_tracked || 0).toFixed(0)} km</Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="ribbon" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>Level {user.level || 0}</Text>
            <Text style={styles.statLabel}>{levelInfo.name}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionsSection}>
            {isFriend ? (
              <>
                <View style={styles.friendBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.friendBadgeText}>You are friends</Text>
                </View>
                <Pressable onPress={openChat} style={styles.chatBtn}>
                  <Ionicons name="chatbubble" size={20} color={Colors.bg} />
                  <Text style={styles.chatBtnText}>Send Message</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={sendFriendRequest}
                disabled={requestSent || sendingRequest}
                style={[
                  styles.addFriendBtn,
                  (requestSent || sendingRequest) && styles.addFriendBtnDisabled,
                ]}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color={Colors.bg} />
                ) : (
                  <>
                    <Ionicons
                      name={requestSent ? "checkmark" : "person-add"}
                      size={20}
                      color={requestSent ? Colors.text : Colors.bg}
                    />
                    <Text
                      style={[
                        styles.addFriendBtnText,
                        requestSent && styles.addFriendBtnTextDisabled,
                      ]}
                    >
                      {requestSent ? "Request Sent" : "Add Friend"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.ownProfileNote}>
            <Ionicons name="information-circle" size={20} color={Colors.muted} />
            <Text style={styles.ownProfileNoteText}>This is your profile</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  content: {
    padding: 16,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  profileHeader: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  username: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionsSection: {
    gap: 12,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 16,
    padding: 16,
  },
  friendBadgeText: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  chatBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  addFriendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  addFriendBtnDisabled: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addFriendBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  addFriendBtnTextDisabled: {
    color: Colors.text,
  },
  ownProfileNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  ownProfileNoteText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});

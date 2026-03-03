import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Friend = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

type SearchUser = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

export default function FriendsScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadFriends = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Friend[]>("/api/friends", headers);
      setFriends(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!headers || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await apiGet<SearchUser[]>(
        `/api/users/search?username=${encodeURIComponent(query.trim())}`,
        headers
      );
      // Filter out existing friends
      const friendIds = new Set(friends.map((f) => f.id));
      setSearchResults(data.filter((u) => !friendIds.has(u.id)));
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setSearching(false);
    }
  }, [headers, friends]);

  const handleAddFriend = async (username: string, userId: string) => {
    if (!headers) return;
    setAddingFriend(userId);
    try {
      await apiPost("/api/friends/request", { to_username: username }, headers);
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send request");
    } finally {
      setAddingFriend(null);
    }
  };

  const handleMessage = (userId: string) => {
    router.push(`/community/dm/${userId}`);
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendRow}>
      <Pressable
        style={styles.friendTap}
        onPress={() => router.push(`/profile/${item.id}`)}
        data-testid={`friend-profile-${item.id}`}
      >
        <View style={styles.avatar}>
          {item.profile_photo_base64 ? (
            <Image
              source={{ uri: item.profile_photo_base64 }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={20} color={Colors.muted} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.username}</Text>
          <Text style={styles.friendSub}>Friend</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => handleMessage(item.id)}
        style={styles.actionBtn}
      >
        <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
      </Pressable>
    </View>
  );

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <View style={styles.friendRow}>
      <Pressable
        style={styles.friendTap}
        onPress={() => router.push(`/profile/${item.id}`)}
        data-testid={`search-profile-${item.id}`}
      >
        <View style={styles.avatar}>
          {item.profile_photo_base64 ? (
            <Image
              source={{ uri: item.profile_photo_base64 }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={20} color={Colors.muted} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.username}</Text>
          <Text style={styles.friendSub}>Not a friend yet</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => handleAddFriend(item.username, item.id)}
        disabled={addingFriend === item.id}
        style={[styles.addBtn, addingFriend === item.id && styles.addBtnLoading]}
      >
        {addingFriend === item.id ? (
          <ActivityIndicator size="small" color={Colors.bg} />
        ) : (
          <>
            <Ionicons name="person-add" size={16} color={Colors.bg} />
            <Text style={styles.addBtnText}>Add</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerBtn}>
          <Text style={styles.friendCount}>{friends.length}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search users to add..."
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <View style={styles.searchResults}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searching ? (
            <ActivityIndicator color={Colors.accent} style={{ padding: 20 }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No users found</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {/* Friends List */}
      <View style={styles.friendsSection}>
        <Text style={styles.sectionTitle}>
          Your Friends ({friends.length})
        </Text>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ padding: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : friends.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>
              Search for users above to add them as friends
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriend}
            contentContainerStyle={styles.friendsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  friendCount: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_900Black",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  searchResults: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  friendsSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  friendsList: {
    gap: 8,
    paddingBottom: 20,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  friendSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  addBtnLoading: {
    opacity: 0.7,
  },
  addBtnText: {
    color: Colors.bg,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    padding: 20,
  },
});

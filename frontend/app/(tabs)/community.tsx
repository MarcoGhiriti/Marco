import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { FriendRequestOut, GroupOut, UserSearchOut } from "../../src/types/community";

const TopTabs = createMaterialTopTabNavigator();

function ChatsTab() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchOut[]>([]);
  const [friends, setFriends] = useState<UserSearchOut[]>([]);
  const [requests, setRequests] = useState<FriendRequestOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadFriends = useCallback(async () => {
    if (!headers) return;
    const data = await apiGet<UserSearchOut[]>("/api/friends", headers);
    setFriends(data);
  }, [headers]);

  const loadRequests = useCallback(async () => {
    if (!headers) return;
    const data = await apiGet<FriendRequestOut>("/api/friends/requests", headers);
    setRequests(data);
  }, [headers]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);
        await Promise.all([loadFriends(), loadRequests()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadFriends, loadRequests]);

  const onSearch = useCallback(async () => {
    if (!headers) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const data = await apiGet<UserSearchOut[]>(`/api/users/search?username=${encodeURIComponent(term)}`, headers);
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [headers, q]);

  const openChat = (userId: string) => {
    router.push(`/community/dm/${userId}`);
  };

  const sendRequest = useCallback(async (toUsername: string) => {
    if (!headers) return;
    await apiPost("/api/friends/request", { to_username: toUsername }, headers);
    await loadRequests();
  }, [headers, loadRequests]);

  const acceptRequest = useCallback(async (fromUserId: string) => {
    if (!headers) return;
    await apiPost("/api/friends/accept", { from_user_id: fromUserId }, headers);
    await Promise.all([loadFriends(), loadRequests()]);
  }, [headers, loadFriends, loadRequests]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={styles.inner} onPress={() => {}}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={onSearch}
              placeholder="Search users"
              placeholderTextColor={Colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={onSearch} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>Go</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {requests?.incoming?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requests</Text>
            {requests.incoming.map((u) => (
              <View key={u.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{u.username}</Text>
                <Pressable onPress={() => acceptRequest(u.id)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Accept</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {results.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search results</Text>
            {results.map((u) => (
              <View key={u.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{u.username}</Text>
                <Pressable onPress={() => sendRequest(u.username)} style={styles.smallGhost}>
                  <Text style={styles.smallGhostText}>Add</Text>
                </Pressable>
                <Pressable onPress={() => openChat(u.id)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Chat</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chats</Text>
          {friends.length === 0 ? (
            <Text style={styles.mutedText}>No friends yet.</Text>
          ) : (
            friends.map((f) => (
              <Pressable key={f.id} onPress={() => openChat(f.id)} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{f.username}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </Pressable>
            ))
          )}
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function GroupsTab() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadGroups = useCallback(async () => {
    if (!headers) return;
    const data = await apiGet<GroupOut[]>("/api/groups", headers);
    setGroups(data);
  }, [headers]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadGroups();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load groups");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadGroups]);

  const createGroup = useCallback(async () => {
    if (!headers) return;
    const n = name.trim();
    if (!n) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost("/api/groups", { name: n, description: description.trim(), is_private: false }, headers);
      setName("");
      setDescription("");
      setShowCreateModal(false);
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }, [headers, name, description, loadGroups]);

  const openGroup = (groupId: string) => {
    router.push(`/community/group/${groupId}`);
  };

  return (
    <View style={styles.inner}>
      {/* Create Group Button */}
      <Pressable onPress={() => setShowCreateModal(true)} style={styles.createGroupBtn}>
        <View style={styles.createGroupIcon}>
          <Ionicons name="add" size={24} color={Colors.bg} />
        </View>
        <View style={styles.createGroupText}>
          <Text style={styles.createGroupTitle}>Create New Group</Text>
          <Text style={styles.createGroupSub}>Start a riding community</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
      </Pressable>

      {/* Create Modal */}
      {showCreateModal && (
        <View style={styles.createModal}>
          <View style={styles.createModalHeader}>
            <Text style={styles.createModalTitle}>New Group</Text>
            <Pressable onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.createModalForm}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Group Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="E.g.: Transylvania Riders"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
              />
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What's this group about?"
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
              />
            </View>
            
            <Pressable 
              onPress={createGroup} 
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.createBtnText}>Create Group</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {loading && !showCreateModal ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Groups</Text>
        {groups.length === 0 ? (
          <View style={styles.emptyGroups}>
            <Ionicons name="people-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyGroupsText}>No groups yet</Text>
          </View>
        ) : (
          groups.map((g) => {
            const isAdmin = !!me?.id && (g.admins ?? []).includes(me.id);
            const membersCount = g.members_count ?? (g.members ? g.members.length : 0);
            return (
              <Pressable key={g.id} onPress={() => openGroup(g.id)} style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={24} color={Colors.accent} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={styles.groupMembers}>{membersCount} members</Text>
                </View>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Community</Text>
          <Text style={styles.sub}>Chats & groups</Text>
        </View>

        <TopTabs.Navigator
          screenOptions={{
            tabBarStyle: { backgroundColor: Colors.bg },
            tabBarIndicatorStyle: { backgroundColor: Colors.accent },
            tabBarActiveTintColor: Colors.text,
            tabBarInactiveTintColor: Colors.muted,
            tabBarLabelStyle: { fontWeight: "900" },
          }}
        >
          <TopTabs.Screen name="Chats" component={ChatsTab} />
          <TopTabs.Screen name="Groups" component={GroupsTab} />
        </TopTabs.Navigator>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4 },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: "700" },
  searchBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { color: Colors.bg, fontSize: 13, fontWeight: "900" },
  center: { paddingVertical: 14, alignItems: "center" },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12, fontWeight: "800" },
  section: { marginTop: 16, gap: 10 },
  sectionTitle: { color: Colors.text, fontSize: 13, fontWeight: "900" },
  mutedText: { color: Colors.muted, fontSize: 12, fontWeight: "700" },
  rowCard: {
    minHeight: 48,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowTitle: { color: Colors.text, fontSize: 14, fontWeight: "900" },
  smallBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: Colors.bg, fontSize: 12, fontWeight: "900" },
  smallGhost: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallGhostText: { color: Colors.text, fontSize: 12, fontWeight: "900" },
  createRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  createInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});

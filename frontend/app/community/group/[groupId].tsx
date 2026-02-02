import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../../../src/theme/colors";
import { apiGet, apiPost, apiPut } from "../../../src/lib/api";
import { getSocket } from "../../../src/lib/realtime";
import { useAuthStore } from "../../../src/state/authStore";
import type { MessageOut } from "../../../src/types/community";

type GroupMember = {
  id: string;
  username: string;
  avatar?: string | null;
  level: number;
};

type GroupInfo = {
  group_id: string;
  group_name: string;
  created_by: string;
  members: GroupMember[];
  // optional fields depending on endpoint
  name?: string;
  photo_base64?: string | null;
};

export default function GroupChatScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const gid = String(groupId ?? "");

  const { accessToken, me } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("Group Chat");
  
  // Members modal
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [friends, setFriends] = useState<GroupMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // Edit group modal
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupPhoto, setEditGroupPhoto] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  
  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const listRef = useRef<FlatList<MessageOut> | null>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const isCreator = groupInfo?.created_by === me?.id;

  const loadHistory = useCallback(async () => {
    if (!authHeader || !gid) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<MessageOut[]>(`/api/groups/${gid}/messages`, authHeader);
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [authHeader, gid]);

  const loadGroupInfo = useCallback(async () => {
    if (!authHeader || !gid) return;
    setLoadingMembers(true);
    try {
      const data = await apiGet<GroupInfo>(`/api/groups/${gid}/members`, authHeader);
      setGroupInfo(data);
      setGroupName(data.group_name || "Group Chat");
    } catch (e) {
      console.error("Failed to load group info:", e);
    } finally {
      setLoadingMembers(false);
    }
  }, [authHeader, gid]);

  const loadFriends = useCallback(async () => {
    if (!authHeader) return;
    try {
      const data = await apiGet<GroupMember[]>("/api/friends", authHeader);
      setFriends(data);
    } catch (e) {
      console.error("Failed to load friends:", e);
    }
  }, [authHeader]);

  useEffect(() => {
    loadHistory();
    loadGroupInfo();
  }, [loadHistory, loadGroupInfo]);

  useEffect(() => {
    if (!accessToken || !gid) return;

    const s = getSocket(accessToken);
    socketRef.current = s;

    s.emit("group:join", { group_id: gid });

    const onGroupNew = (payload: any) => {
      if (!payload || payload.kind !== "group") return;
      if (payload.group_id !== gid) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload as MessageOut];
      });
    };

    s.on("group:new", onGroupNew);

    return () => {
      s.off("group:new", onGroupNew);
    };
  }, [accessToken, gid]);

  const onSend = useCallback(() => {
    if (!accessToken || !gid) return;
    const s = socketRef.current ?? getSocket(accessToken);
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    s.emit("group:send", { group_id: gid, text: trimmed });
  }, [accessToken, gid, text]);

  const handleOpenMembers = () => {
    loadGroupInfo();
    loadFriends();
    setShowMembersModal(true);
  };

  const handleOpenEditGroup = () => {
    if (!groupInfo) return;
    setEditGroupName(groupInfo.name || groupInfo.group_name || "");
    setEditGroupPhoto(groupInfo.photo_base64 || null);
    setShowEditGroupModal(true);
  };

  const handleSaveGroupEdit = async () => {
    if (!authHeader || !gid) return;
    setEditSaving(true);
    try {
      await apiPut(`/api/groups/${gid}`, {
        name: editGroupName.trim(),
        photo_base64: editGroupPhoto,
      }, authHeader);
      setShowEditGroupModal(false);
      setGroupName(editGroupName.trim());
      loadGroupInfo();
      Alert.alert("Success", "Group updated!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update group");
    } finally {
      setEditSaving(false);
    }
  };

  const handlePickGroupPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setEditGroupPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleInviteToGroup = async (userId: string) => {
    if (!authHeader || !gid) return;
    try {
      await apiPost(`/api/groups/${gid}/add-member`, { user_id: userId }, authHeader);
      Alert.alert("Success", "Invitation sent! User has been added to the group.");
      loadGroupInfo();
      setShowInviteModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to invite");
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!authHeader) return;
    try {
      await apiPost(`/api/groups/${gid}/add-member`, { user_id: userId }, authHeader);
      Alert.alert("Success", "Member added to the group");
      loadGroupInfo();
      setShowAddMember(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to add member");
    }
  };

  const handleRemoveMember = (userId: string, username: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${username} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!authHeader) return;
            try {
              await apiPost(`/api/groups/${gid}/remove-member`, { user_id: userId }, authHeader);
              loadGroupInfo();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to remove member");
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (!me?.id) return;
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            if (!authHeader) return;
            try {
              await apiPost(`/api/groups/${gid}/remove-member`, { user_id: me.id }, authHeader);
              router.back();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to leave group");
            }
          },
        },
      ]
    );
  };

  // Friends not yet in group
  const availableFriends = friends.filter(
    (f) => !groupInfo?.members.some((m) => m.id === f.id)
  );

  const renderMessage = ({ item: m }: { item: MessageOut }) => {
    const mine = m.from_user_id === me?.id;
    return (
      <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
        {!mine && (
          <View style={styles.avatar}>
            <Ionicons name="person" size={14} color={Colors.muted} />
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine && m.from_username && (
            <Text style={styles.bubbleSender}>{m.from_username}</Text>
          )}
          <Text style={[styles.bubbleText, mine && { color: Colors.bg }]}>
            {m.text}
          </Text>
          <Text style={[styles.bubbleTime, mine && { color: "rgba(0,0,0,0.5)" }]}>
            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            {groupInfo?.photo_base64 ? (
              <Image source={{ uri: groupInfo.photo_base64 }} style={styles.groupPhoto} />
            ) : (
              <View style={styles.headerIcon}>
                <Ionicons name="people" size={20} color={Colors.accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={styles.headerSub}>
                {groupInfo?.members.length || 0} members
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {isCreator && (
              <Pressable onPress={handleOpenEditGroup} style={styles.headerBtn}>
                <Ionicons name="create-outline" size={18} color={Colors.accent} />
              </Pressable>
            )}
            <Pressable onPress={() => { loadFriends(); setShowInviteModal(true); }} style={styles.headerBtn}>
              <Ionicons name="person-add-outline" size={18} color={Colors.accent} />
            </Pressable>
            <Pressable onPress={handleOpenMembers} style={styles.headerBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Messages */}
        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading messages…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="warning-outline" size={48} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles" size={64} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Be the first to send a message to this group!
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Composer */}
        <View style={styles.composer}>
          <View style={styles.inputContainer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              multiline
            />
          </View>
          <Pressable 
            onPress={onSend} 
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color={text.trim() ? Colors.bg : Colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Group Members</Text>
            <Pressable onPress={() => setShowMembersModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Add Member Button (only for creator) */}
            {isCreator && (
              <Pressable 
                onPress={() => setShowAddMember(!showAddMember)} 
                style={styles.addMemberBtn}
              >
                <Ionicons name="person-add" size={20} color={Colors.bg} />
                <Text style={styles.addMemberBtnText}>Add Member</Text>
              </Pressable>
            )}

            {/* Add Member Section */}
            {showAddMember && isCreator && (
              <View style={styles.addMemberSection}>
                <Text style={styles.sectionTitle}>Add from friends</Text>
                {availableFriends.length === 0 ? (
                  <Text style={styles.mutedText}>All your friends are already in this group</Text>
                ) : (
                  availableFriends.map((f) => (
                    <View key={f.id} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberAvatar}>
                          {f.avatar ? (
                            <Image
                              source={{ uri: f.avatar.startsWith("data:") ? f.avatar : `data:image/jpeg;base64,${f.avatar}` }}
                              style={styles.memberAvatarImg}
                            />
                          ) : (
                            <Ionicons name="person" size={18} color={Colors.muted} />
                          )}
                        </View>
                        <Text style={styles.memberName}>{f.username}</Text>
                      </View>
                      <Pressable onPress={() => handleAddMember(f.id)} style={styles.addBtn}>
                        <Ionicons name="add" size={18} color={Colors.bg} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Members List */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>
                Members ({groupInfo?.members.length || 0})
              </Text>
              
              {loadingMembers ? (
                <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
              ) : (
                groupInfo?.members.map((member) => {
                  const isSelf = member.id === me?.id;
                  const isGroupCreator = member.id === groupInfo?.created_by;
                  
                  return (
                    <View key={member.id} style={styles.memberRow}>
                      <Pressable 
                        onPress={() => router.push(`/profile/${member.id}`)}
                        style={styles.memberInfo}
                      >
                        <View style={styles.memberAvatar}>
                          {member.avatar ? (
                            <Image
                              source={{ uri: member.avatar.startsWith("data:") ? member.avatar : `data:image/jpeg;base64,${member.avatar}` }}
                              style={styles.memberAvatarImg}
                            />
                          ) : (
                            <Ionicons name="person" size={18} color={Colors.muted} />
                          )}
                        </View>
                        <View>
                          <Text style={styles.memberName}>
                            {member.username} {isSelf && "(You)"}
                          </Text>
                          <Text style={styles.memberLevel}>
                            {isGroupCreator ? "👑 Creator" : `Level ${member.level}`}
                          </Text>
                        </View>
                      </Pressable>
                      
                      {/* Remove button - creator can remove others, users can remove themselves */}
                      {(isCreator && !isGroupCreator) || isSelf ? (
                        <Pressable 
                          onPress={() => isSelf ? handleLeaveGroup() : handleRemoveMember(member.id, member.username)}
                          style={styles.removeBtn}
                        >
                          <Ionicons name={isSelf ? "exit-outline" : "remove"} size={18} color={Colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>

            {/* Leave Group Button (for non-creators) */}
            {!isCreator && (
              <Pressable onPress={handleLeaveGroup} style={styles.leaveGroupBtn}>
                <Ionicons name="exit-outline" size={20} color={Colors.danger} />
                <Text style={styles.leaveGroupBtnText}>Leave Group</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        visible={showEditGroupModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditGroupModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.editModalOverlay}
        >
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Group</Text>
              <Pressable onPress={() => setShowEditGroupModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.editModalBody}>
              {/* Group Photo */}
              <Pressable onPress={handlePickGroupPhoto} style={styles.photoPickerBtn}>
                {editGroupPhoto ? (
                  <Image source={{ uri: editGroupPhoto }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.muted} />
                    <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </Pressable>

              {/* Group Name */}
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.editInput}
                value={editGroupName}
                onChangeText={setEditGroupName}
                placeholder="Enter group name"
                placeholderTextColor={Colors.muted}
              />

              <Pressable
                onPress={handleSaveGroupEdit}
                disabled={editSaving || !editGroupName.trim()}
                style={[styles.saveBtn, (editSaving || !editGroupName.trim()) && styles.saveBtnDisabled]}
              >
                {editSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.inviteModalOverlay}>
          <View style={styles.inviteModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Invite Friends</Text>
              <Pressable onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.inviteList}>
              {availableFriends.length === 0 ? (
                <View style={styles.emptyInvite}>
                  <Ionicons name="people-outline" size={48} color={Colors.muted} />
                  <Text style={styles.emptyInviteText}>
                    All your friends are already in this group
                  </Text>
                </View>
              ) : (
                availableFriends.map((f) => (
                  <View key={f.id} style={styles.inviteFriendRow}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberAvatar}>
                        {f.avatar ? (
                          <Image
                            source={{ uri: f.avatar.startsWith("data:") ? f.avatar : `data:image/jpeg;base64,${f.avatar}` }}
                            style={styles.memberAvatarImg}
                          />
                        ) : (
                          <Ionicons name="person" size={18} color={Colors.muted} />
                        )}
                      </View>
                      <Text style={styles.memberName}>{f.username}</Text>
                    </View>
                    <Pressable onPress={() => handleInviteToGroup(f.id)} style={styles.inviteBtn}>
                      <Ionicons name="paper-plane" size={16} color="#FFF" />
                      <Text style={styles.inviteBtnText}>Invite</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  
  // Body
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorText: { color: Colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  
  // Messages
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  bubbleRowMine: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: {
    color: Colors.accent,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  bubbleText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bubbleTime: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  
  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputContainer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 12,
  },
  sendBtn: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  addMemberBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  addMemberSection: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  mutedText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  membersSection: {
    gap: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  memberName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  memberLevel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
  },
  leaveGroupBtnText: {
    color: Colors.danger,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  // Header actions
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  groupPhoto: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  // Edit Group Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  editModalContent: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editModalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  editModalBody: {
    padding: 20,
  },
  photoPickerBtn: {
    alignSelf: "center",
    marginBottom: 20,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  // Invite Modal
  inviteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  inviteModalContent: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
  },
  inviteList: {
    padding: 16,
  },
  emptyInvite: {
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyInviteText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  inviteFriendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inviteBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

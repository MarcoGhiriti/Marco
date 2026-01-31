import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../../src/theme/colors";
import { apiGet } from "../../../src/lib/api";
import { getSocket } from "../../../src/lib/realtime";
import { useAuthStore } from "../../../src/state/authStore";
import type { MessageOut } from "../../../src/types/community";

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

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
            <View style={styles.headerIcon}>
              <Ionicons name="people" size={20} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={styles.headerSub}>Group Chat</Text>
            </View>
          </View>
          <View style={styles.headerBtn}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.text} />
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
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
  },
  
  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  bubbleRowMine: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  bubbleText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  bubbleTime: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  
  // Composer
  composer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    minHeight: 40,
    maxHeight: 100,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sendBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

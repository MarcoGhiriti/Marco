import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

export default function DmChatScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const otherUserId = String(userId ?? "");

  const { accessToken, me } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<{ username: string; photo: string | null }>({ username: "", photo: null });

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const listRef = useRef<FlatList<MessageOut> | null>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };

  const scrollToBottom = useCallback((animated = true) => {
    // FlatList without inverted: last item is the bottom
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToEnd({ animated });
      } catch {
        // ignore
      }
    });
  }, []);

  }, [accessToken]);

  const loadHistory = useCallback(async () => {
    if (!authHeader || !otherUserId) return;
    setError(null);
    setLoading(true);
    try {
      // Load messages
      const data = await apiGet<MessageOut[]>(`/api/dm/${otherUserId}/messages`, authHeader);
      setMessages(data);
      scrollToBottom(false);
      
      // Try to get user info
      try {
        const userInfo = await apiGet<{ id: string; username: string; profile_photo_base64?: string | null }>(
          `/api/users/${otherUserId}`,
          authHeader
        );
        setOtherUser({
          username: userInfo.username || "User",
          photo: userInfo.profile_photo_base64 || null,
        });
      } catch {
        // Fallback: get username from messages
        const otherMsg = data.find(m => m.from_user_id === otherUserId);
        if (otherMsg?.from_username) {
          setOtherUser({ username: otherMsg.from_username, photo: null });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [authHeader, otherUserId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!accessToken || !otherUserId) return;

    const s = getSocket(accessToken);
    socketRef.current = s;

    const onDmNew = (payload: any) => {
      if (!payload || payload.kind !== "dm") return;
      const involves =
        payload.to_user_id === otherUserId || payload.from_user_id === otherUserId;
      if (!involves) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload as MessageOut];
      });
      scrollToBottom();
    };

    s.on("dm:new", onDmNew);

    return () => {
      s.off("dm:new", onDmNew);
    };
  }, [accessToken, otherUserId]);

  const onSend = useCallback(() => {
    if (!accessToken || !otherUserId) return;
    const s = socketRef.current ?? getSocket(accessToken);
    const trimmed = text.trim();
    if (!trimmed) return;

    // Clear input and scroll immediately so user sees what they sent.
    setText("");
    scrollToBottom();

    s.emit("dm:send", {
      to_user_id: otherUserId,
      text: trimmed,
    });
  }, [accessToken, otherUserId, text, scrollToBottom]);

  const renderMessage = ({ item: m }: { item: MessageOut }) => {
    const mine = m.from_user_id === me?.id;
    return (
      <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
        {!mine && (
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={Colors.muted} />
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
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
            <View style={styles.headerAvatar}>
              {otherUser.photo ? (
                <Image source={{ uri: otherUser.photo }} style={styles.headerAvatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={Colors.accent} />
              )}
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {otherUser.username || "Loading..."}
              </Text>
              <Text style={styles.headerSub}>Direct Message</Text>
            </View>
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
                <Ionicons name="bicycle" size={64} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Start the conversation! Send a message to your riding buddy.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={(r) => {
                listRef.current = r;
              }}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollToBottom(false)}
              onLayout={() => scrollToBottom(false)}
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
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerAvatarImage: {
    width: "100%",
    height: "100%",
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
    width: 32,
    height: 32,
    borderRadius: 16,
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

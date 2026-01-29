import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadHistory = useCallback(async () => {
    if (!authHeader || !otherUserId) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<MessageOut[]>(`/api/dm/${otherUserId}/messages`, authHeader);
      setMessages(data);
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

    setText("");
    s.emit("dm:send", {
      to_user_id: otherUserId,
      text: trimmed,
    });
  }, [accessToken, otherUserId, text]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Chat
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {otherUserId}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.centerText}>Loading messages…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.centerText}>No messages yet.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {messages.map((m) => {
                const mine = m.from_user_id === me?.id;
                return (
                  <View
                    key={m.id}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                  >
                    <Text style={[styles.bubbleText, mine && { color: Colors.bg }]}>
                      {m.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable onPress={onSend} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color={Colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
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
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: "900" },
  headerSub: { marginTop: 2, color: Colors.muted, fontSize: 12, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  list: { gap: 10 },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: Colors.card,
  },
  bubbleText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  centerText: { color: Colors.muted, fontSize: 13, fontWeight: "700" },
  errorText: { color: Colors.danger, fontSize: 12, fontWeight: "800", textAlign: "center" },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  sendBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});

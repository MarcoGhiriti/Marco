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
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Message = {
  id: string;
  sender_id: string;
  sender_username: string;
  text: string;
  created_at: string;
};

type ChatData = {
  chat_id: string;
  listing_id: string;
  listing_title: string;
  seller_id: string;
  buyer_id: string;
  other_username: string;
  messages: Message[];
};

export default function ListingChatScreen() {
  const router = useRouter();
  const { chatId, listingId } = useLocalSearchParams<{ chatId?: string; listingId?: string }>();
  const { accessToken, me } = useAuthStore();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatRef = useRef<FlatList>(null);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadMessages = useCallback(async () => {
    if (!authHeader || !chatId) return;
    try {
      const data = await apiGet<ChatData>(`/api/marketplace/chat/${chatId}/messages`, authHeader);
      setChatData(data);
      setMessages(data.messages);
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, chatId]);

  useEffect(() => {
    if (chatId) {
      loadMessages();
      const interval = setInterval(loadMessages, 8000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [chatId, loadMessages]);

  const handleSend = async () => {
    if (!authHeader || !text.trim()) return;
    setSending(true);
    try {
      let result;
      if (chatId) {
        result = await apiPost(`/api/marketplace/chat/${chatId}/send`, { text: text.trim() }, authHeader);
      } else if (listingId) {
        result = await apiPost(`/api/marketplace/chat/listing/${listingId}/send`, { text: text.trim() }, authHeader);
      }
      if (result) {
        const newMsg: Message = {
          id: result.id,
          sender_id: result.sender_id || me?.id || "",
          sender_username: me?.username || "You",
          text: text.trim(),
          created_at: result.created_at || new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setText("");
        if (!chatId && result.chat_id) {
          router.setParams({ chatId: result.chat_id });
        }
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
      console.error("Send failed", e);
    } finally {
      setSending(false);
    }
  };

  const uid = me?.id;
  const title = chatData?.listing_title || "Chat";
  const otherName = chatData?.other_username || "";

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === uid;
    return (
      <View style={[s.msgRow, isMe && s.msgRowMe]} data-testid={`msg-${item.id}`}>
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
          {!isMe && <Text style={s.senderName}>{item.sender_username}</Text>}
          <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.text}</Text>
          <Text style={[s.msgTime, isMe && s.msgTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} data-testid="chat-back-btn">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {otherName ? <Text style={s.headerSub}>{otherName}</Text> : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.ttlNote}>
        <Ionicons name="time-outline" size={12} color={Colors.muted} />
        <Text style={s.ttlText}>Chats are automatically deleted after 30 days.</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={Colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.muted} />
                <Text style={s.emptyText}>Start the conversation</Text>
              </View>
            }
          />
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={1000}
            data-testid="chat-input"
          />
          <Pressable
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            data-testid="chat-send-btn"
          >
            {sending ? (
              <ActivityIndicator color={Colors.bg} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={Colors.bg} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
  },
  headerInfo: { flex: 1, gap: 2 },
  headerTitle: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  headerSub: { color: Colors.muted, fontSize: 12, fontWeight: "600" },
  ttlNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  ttlText: { color: Colors.muted, fontSize: 10, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msgList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  msgRow: { marginBottom: 8, flexDirection: "row" },
  msgRowMe: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleMe: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  senderName: { color: Colors.accent, fontSize: 11, fontWeight: "700", marginBottom: 2 },
  msgText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  msgTextMe: { color: Colors.bg },
  msgTime: { color: Colors.muted, fontSize: 10, marginTop: 4, textAlign: "right" },
  msgTimeMe: { color: "rgba(0,0,0,0.4)" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText: { color: Colors.muted, fontSize: 14, fontWeight: "600" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: Colors.text, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});

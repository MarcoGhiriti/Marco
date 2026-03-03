import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Conversation = {
  id: string;
  listing_id: string;
  listing_title: string;
  buyer_id: string;
  seller_id: string;
  other_user_id: string;
  other_username: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

export default function ListingMessagesScreen() {
  const router = useRouter();
  const { listingId, title } = useLocalSearchParams<{ listingId: string; title?: string }>();
  const { accessToken } = useAuthStore();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!authHeader || !listingId) return;
    try {
      setLoading(true);
      const data = await apiGet<Conversation[]>(`/api/marketplace/chat/listing/${listingId}/conversations`, authHeader);
      setConvos(data);
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, listingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }: { item: Conversation }) => (
    <Pressable
      style={s.convoCard}
      onPress={() => router.push(`/marketplace/chat?chatId=${item.id}`)}
      data-testid={`convo-${item.id}`}
    >
      <View style={s.avatar}>
        <Ionicons name="person" size={20} color={Colors.accent} />
      </View>
      <View style={s.convoBody}>
        <View style={s.convoHeader}>
          <Text style={s.convoName} numberOfLines={1}>{item.other_username}</Text>
          <Text style={s.convoTime}>
            {new Date(item.last_message_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={s.convoPreview} numberOfLines={1}>{item.last_message}</Text>
      </View>
      {item.unread_count > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{item.unread_count}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} data-testid="listing-msgs-back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>Messages</Text>
          {title ? <Text style={s.headerSub} numberOfLines={1}>{decodeURIComponent(title)}</Text> : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.ttlNote}>
        <Ionicons name="time-outline" size={12} color={Colors.muted} />
        <Text style={s.ttlText}>Chats are automatically deleted after 30 days.</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      ) : convos.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={Colors.muted} />
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyText}>Buyers will appear here when they message you.</Text>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
  },
  headerInfo: { flex: 1, gap: 2 },
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  headerSub: { color: Colors.muted, fontSize: 12, fontWeight: "600" },
  ttlNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  ttlText: { color: Colors.muted, fontSize: 10, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  emptyText: { color: Colors.muted, fontSize: 14, fontWeight: "600", textAlign: "center" },
  list: { padding: 16, gap: 8 },
  convoCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.card2, alignItems: "center", justifyContent: "center",
  },
  convoBody: { flex: 1, gap: 4 },
  convoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convoName: { color: Colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  convoTime: { color: Colors.muted, fontSize: 11, fontWeight: "600" },
  convoPreview: { color: Colors.muted, fontSize: 13 },
  badge: {
    backgroundColor: Colors.danger, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

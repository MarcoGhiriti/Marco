import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

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

export default function MarketplaceAccountScreen() {
  const router = useRouter();
  const { accessToken, me } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [buyerConversations, setBuyerConversations] = useState<Conversation[]>([]);

  const authHeader = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadConversations = useCallback(async () => {
    if (!authHeader || !me?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiGet<Conversation[]>("/api/marketplace/chat/conversations", authHeader);
      setBuyerConversations(data.filter((conversation) => conversation.buyer_id === me.id));
    } catch (e) {
      console.error("Failed to load marketplace account conversations", e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, me?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} data-testid="marketplace-account-back-btn">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.accountHeroCard}
          onPress={() => router.push("/marketplace/my-listings")}
          data-testid="shop-account-seller-tools-btn"
        >
          <View style={styles.accountHeroIconBox}>
            <Ionicons name="storefront" size={24} color={Colors.accent} />
          </View>
          <View style={styles.accountHeroInfo}>
            <Text style={styles.accountHeroTitle}>Seller tools</Text>
            <Text style={styles.accountHeroSub}>My listings and buyer conversations for what you sell.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
        </Pressable>

        <View style={styles.accountSection}>
          <Text style={styles.accountSectionTitle}>Buyer messages</Text>
          <Text style={styles.accountSectionSub}>All your purchase conversations in one place.</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          ) : buyerConversations.length === 0 ? (
            <View style={styles.accountEmptyCard} data-testid="shop-account-empty-buyer-messages">
              <Ionicons name="chatbubble-ellipses-outline" size={42} color={Colors.muted} />
              <Text style={styles.accountEmptyTitle}>No buyer chats yet</Text>
              <Text style={styles.accountEmptyText}>When you message a seller from a listing, the conversation will appear here.</Text>
            </View>
          ) : (
            buyerConversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                style={styles.accountConversationCard}
                onPress={() => router.push(`/marketplace/chat?chatId=${conversation.id}`)}
                data-testid={`shop-account-conversation-${conversation.id}`}
              >
                <View style={styles.accountConversationAvatar}>
                  <Ionicons name="person" size={18} color={Colors.accent} />
                </View>
                <View style={styles.accountConversationBody}>
                  <View style={styles.accountConversationHeader}>
                    <Text style={styles.accountConversationTitle} numberOfLines={1}>{conversation.listing_title}</Text>
                    <Text style={styles.accountConversationTime}>{new Date(conversation.last_message_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.accountConversationSeller} numberOfLines={1}>Seller: {conversation.other_username}</Text>
                  <Text style={styles.accountConversationPreview} numberOfLines={1}>{conversation.last_message || "Open chat"}</Text>
                </View>
                {conversation.unread_count > 0 ? (
                  <View style={styles.accountUnreadBadge}>
                    <Text style={styles.accountUnreadBadgeText}>{conversation.unread_count}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  accountHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  accountHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.accent}15`,
  },
  accountHeroInfo: { flex: 1, gap: 2 },
  accountHeroTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  accountHeroSub: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  accountSection: { gap: 10 },
  accountSectionTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  accountSectionSub: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  center: { paddingVertical: 40, alignItems: "center" },
  accountEmptyCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  accountEmptyTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  accountEmptyText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  accountConversationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  accountConversationAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
  },
  accountConversationBody: { flex: 1, gap: 3 },
  accountConversationHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  accountConversationTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  accountConversationTime: { color: Colors.muted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  accountConversationSeller: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  accountConversationPreview: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  accountUnreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: Colors.danger,
  },
  accountUnreadBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_900Black" },
});
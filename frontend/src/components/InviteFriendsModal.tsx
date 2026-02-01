import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

export type InviteFriend = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

type Props = {
  visible: boolean;
  title?: string;
  friends: InviteFriend[];
  loading?: boolean;
  onClose: () => void;
  onInvite: (friendId: string) => Promise<void> | void;
  emptyTitle?: string;
  emptySubtitle?: string;
};

function normalizeAvatarUri(base64?: string | null) {
  if (!base64) return null;
  if (base64.startsWith("data:")) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

export function InviteFriendsModal({
  visible,
  title = "Invită prieteni",
  friends,
  loading,
  onClose,
  onInvite,
  emptyTitle = "Nu ai prieteni de invitat",
  emptySubtitle = "Adaugă prieteni ca să îi poți invita.",
}: Props) {
  const [sendingId, setSendingId] = useState<string | null>(null);

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.centerText}>Se încarcă…</Text>
        </View>
      );
    }

    if (!friends.length) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={44} color={Colors.muted} />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {friends.map((f) => {
          const avatarUri = normalizeAvatarUri(f.profile_photo_base64);
          const isSending = sendingId === f.id;
          return (
            <View key={f.id} style={styles.row}>
              <View style={styles.userInfo}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={16} color={Colors.muted} />
                  </View>
                )}
                <Text style={styles.username} numberOfLines={1}>
                  {f.username}
                </Text>
              </View>

              <Pressable
                onPress={async () => {
                  try {
                    setSendingId(f.id);
                    await onInvite(f.id);
                  } finally {
                    setSendingId(null);
                  }
                }}
                style={({ pressed }) => [
                  styles.inviteBtn,
                  pressed && Platform.OS !== "web" ? { opacity: 0.85 } : null,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#FFF" />
                    <Text style={styles.inviteBtnText}>Invită</Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    );
  }, [emptySubtitle, emptyTitle, friends, loading, onInvite, sendingId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>

          {content}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: "75%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    paddingRight: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 10,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyWrap: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.card2,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  inviteBtn: {
    height: 44,
    minWidth: 98,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inviteBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

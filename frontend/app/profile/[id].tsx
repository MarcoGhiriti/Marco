import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type UserProfile = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
  bio?: string;
  bike?: { model?: string; cc?: number } | null;
  country?: string | null;
  level?: number;
  km_total?: number;
  joined_routes?: number;
  joined_events?: number;
  license_type?: string | null;
  license_verified?: boolean;
  relationship: "self" | "not_friends" | "request_sent" | "request_received" | "friends";
  created_at?: string;
};

const LEVEL_NAMES = [
  "Newbie", "Beginner", "Rider", "Explorer", "Adventurer",
  "Veteran", "Expert", "Master", "Legend", "Ultimate",
];

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadUser = useCallback(async () => {
    if (!headers || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<UserProfile>(`/api/users/${id}`, headers);
      setUser(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, [headers, id]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const sendFriendRequest = async () => {
    if (!headers || !user) return;
    setActionLoading(true);
    try {
      await apiPost("/api/friends/request", { username: user.username }, headers);
      setUser(prev => prev ? { ...prev, relationship: "request_sent" } : prev);
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut trimite cererea");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelRequest = async () => {
    if (!headers || !user) return;
    setActionLoading(true);
    try {
      await apiPost("/api/friends/cancel", { from_user_id: user.id }, headers);
      setUser(prev => prev ? { ...prev, relationship: "not_friends" } : prev);
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut anula cererea");
    } finally {
      setActionLoading(false);
    }
  };

  const acceptRequest = async () => {
    if (!headers || !user) return;
    setActionLoading(true);
    try {
      await apiPost("/api/friends/accept", { from_user_id: user.id }, headers);
      setUser(prev => prev ? { ...prev, relationship: "friends" } : prev);
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut accepta cererea");
    } finally {
      setActionLoading(false);
    }
  };

  const declineRequest = async () => {
    if (!headers || !user) return;
    setActionLoading(true);
    try {
      await apiPost("/api/friends/reject", { from_user_id: user.id }, headers);
      setUser(prev => prev ? { ...prev, relationship: "not_friends" } : prev);
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut refuza cererea");
    } finally {
      setActionLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!headers || !user) return;
    Alert.alert("Șterge prieten", `Sigur vrei să îl scoți pe ${user.username} din lista de prieteni?`, [
      { text: "Anulează", style: "cancel" },
      {
        text: "Șterge", style: "destructive", onPress: async () => {
          setActionLoading(true);
          try {
            await apiPost("/api/friends/remove", { from_user_id: user.id }, headers);
            setUser(prev => prev ? { ...prev, relationship: "not_friends" } : prev);
          } catch (e) {
            Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut șterge prietenul");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openChat = () => {
    if (!id) return;
    router.push(`/community/dm/${id}`);
  };

  const levelName = LEVEL_NAMES[Math.min((user?.level || 1) - 1, LEVEL_NAMES.length - 1)];

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="profile-back-btn">
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={s.errorText}>{error || "Utilizator negăsit"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="profile-back-btn">
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Profil</Text>
        {user.relationship === "self" ? (
          <Pressable onPress={() => router.push("/profile/edit")} style={s.editBtn} data-testid="edit-profile-btn">
            <Ionicons name="create-outline" size={18} color={Colors.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Avatar & Name */}
        <View style={s.profileHeader}>
          <View style={s.avatarRing}>
            {user.profile_photo_base64 ? (
              <Image
                source={{
                  uri: user.profile_photo_base64.startsWith("data:")
                    ? user.profile_photo_base64
                    : `data:image/jpeg;base64,${user.profile_photo_base64}`,
                }}
                style={s.avatar}
              />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.muted} />
              </View>
            )}
          </View>
          <Text style={s.username} data-testid="profile-username">{user.username}</Text>

          {/* Level Badge */}
          <View style={s.levelBadge}>
            <Ionicons name="star" size={14} color={Colors.accent} />
            <Text style={s.levelText}>Nivel {user.level || 1} - {levelName}</Text>
          </View>

          {/* Bio */}
          {user.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
        </View>

        {/* Info Cards */}
        <View style={s.infoRow}>
          {user.bike?.model && (
            <View style={s.infoChip}>
              <Ionicons name="bicycle" size={14} color={Colors.accent} />
              <Text style={s.infoChipText}>{user.bike.model}{user.bike.cc ? ` ${user.bike.cc}cc` : ""}</Text>
            </View>
          )}
          {user.country && (
            <View style={s.infoChip}>
              <Ionicons name="location" size={14} color={Colors.accent} />
              <Text style={s.infoChipText}>{user.country}</Text>
            </View>
          )}
          {user.license_type && (
            <View style={[s.infoChip, user.license_verified && s.infoChipVerified]}>
              <Ionicons name="card" size={14} color={user.license_verified ? Colors.success : Colors.muted} />
              <Text style={[s.infoChipText, user.license_verified && { color: Colors.success }]}>
                Permis {user.license_type}{user.license_verified ? " ✓" : ""}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsCard}>
          {user.km_total !== undefined && (
            <View style={s.statItem}>
              <Ionicons name="speedometer" size={22} color={Colors.accent} />
              <Text style={s.statValue}>{Math.round(user.km_total)}</Text>
              <Text style={s.statLabel}>km total</Text>
            </View>
          )}
          {user.joined_routes !== undefined && (
            <>
              {user.km_total !== undefined && <View style={s.statDivider} />}
              <View style={s.statItem}>
                <Ionicons name="map" size={22} color={Colors.accent} />
                <Text style={s.statValue}>{user.joined_routes}</Text>
                <Text style={s.statLabel}>rute</Text>
              </View>
            </>
          )}
          {user.joined_events !== undefined && (
            <>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Ionicons name="calendar" size={22} color={Colors.accent} />
                <Text style={s.statValue}>{user.joined_events}</Text>
                <Text style={s.statLabel}>events</Text>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons based on relationship */}
        {user.relationship !== "self" && (
          <View style={s.actions}>
            {user.relationship === "not_friends" && (
              <Pressable
                style={s.primaryBtn}
                onPress={sendFriendRequest}
                disabled={actionLoading}
                data-testid="add-friend-btn"
              >
                {actionLoading ? <ActivityIndicator color={Colors.bg} size="small" /> : (
                  <>
                    <Ionicons name="person-add" size={18} color={Colors.bg} />
                    <Text style={s.primaryBtnText}>Adaugă prieten</Text>
                  </>
                )}
              </Pressable>
            )}

            {user.relationship === "request_sent" && (
              <Pressable
                style={s.secondaryBtn}
                onPress={cancelRequest}
                disabled={actionLoading}
                data-testid="cancel-request-btn"
              >
                <Ionicons name="hourglass" size={18} color={Colors.text} />
                <Text style={s.secondaryBtnText}>Cerere trimisă - Anulează</Text>
              </Pressable>
            )}

            {user.relationship === "request_received" && (
              <View style={s.requestActions}>
                <Pressable
                  style={[s.primaryBtn, { flex: 1 }]}
                  onPress={acceptRequest}
                  disabled={actionLoading}
                  data-testid="accept-request-btn"
                >
                  <Ionicons name="checkmark" size={18} color={Colors.bg} />
                  <Text style={s.primaryBtnText}>Acceptă</Text>
                </Pressable>
                <Pressable
                  style={[s.secondaryBtn, { flex: 1 }]}
                  onPress={declineRequest}
                  disabled={actionLoading}
                  data-testid="decline-request-btn"
                >
                  <Text style={s.secondaryBtnText}>Refuză</Text>
                </Pressable>
              </View>
            )}

            {user.relationship === "friends" && (
              <>
                <View style={s.friendBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={s.friendBadgeText}>Prieteni</Text>
                </View>
                <Pressable style={s.primaryBtn} onPress={openChat} data-testid="send-message-btn">
                  <Ionicons name="chatbubble" size={18} color={Colors.bg} />
                  <Text style={s.primaryBtnText}>Trimite mesaj</Text>
                </Pressable>
                <Pressable style={s.dangerBtn} onPress={removeFriend} data-testid="remove-friend-btn">
                  <Ionicons name="person-remove" size={16} color={Colors.danger} />
                  <Text style={s.dangerBtnText}>Șterge prieten</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {user.relationship === "self" && (
          <Pressable
            style={s.primaryBtn}
            onPress={() => router.push("/profile/edit")}
            data-testid="edit-profile-full-btn"
          >
            <Ionicons name="create-outline" size={18} color={Colors.bg} />
            <Text style={s.primaryBtnText}>Editează profilul</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: Colors.danger, fontSize: 14, fontWeight: "600", textAlign: "center" },
  content: { padding: 16, gap: 16 },
  profileHeader: { alignItems: "center", gap: 10, paddingVertical: 8 },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  username: { color: Colors.text, fontSize: 22, fontWeight: "900" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelText: { color: Colors.text, fontSize: 13, fontWeight: "600" },
  bio: { color: Colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoChipVerified: { borderColor: Colors.success + "50" },
  infoChipText: { color: Colors.text, fontSize: 12, fontWeight: "600" },
  statsCard: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 6 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: "900" },
  statLabel: { color: Colors.muted, fontSize: 11, fontWeight: "600" },
  actions: { gap: 10 },
  requestActions: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnText: { color: Colors.bg, fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryBtnText: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.success + "40",
    borderRadius: 14,
    paddingVertical: 12,
  },
  friendBadgeText: { color: Colors.success, fontSize: 14, fontWeight: "700" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  dangerBtnText: { color: Colors.danger, fontSize: 13, fontWeight: "600" },
});

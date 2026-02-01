import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Polyline as SvgPolyline, Circle } from "react-native-svg";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete, apiPut } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, UserSearchOut } from "../../src/types/api";
import { InviteFriendsModal } from "../../src/components/InviteFriendsModal";

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [route, setRoute] = useState<RouteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [editRules, setEditRules] = useState("");
  const [editParticipantsMin, setEditParticipantsMin] = useState("1");
  const [editParticipantsMax, setEditParticipantsMax] = useState("10");
  const [editSaving, setEditSaving] = useState(false);
  
  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<UserSearchOut[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  useEffect(() => {
    loadRoute();
  }, [id]);

  const loadRoute = async () => {
    if (!headers || !id) return;
    setLoading(true);
    try {
      // For now, get all routes and find the one
      const routes = await apiGet<RouteOut[]>("/api/routes", headers);
      const found = routes.find((r) => r.id === id);
      if (found) {
        setRoute(found);
      } else {
        setError("Route not found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading route");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!route) return;
    try {
      await Share.share({
        message: `🏍️ Route on Moto GO!\n\n📍 ${route.title}\n📏 ${route.distance_km.toFixed(1)} km\n⏱️ ${route.duration_min} min\n\n${route.description || "Join me on this ride!"}`,
        title: route.title,
      });
    } catch (error) {
      Alert.alert("Error", "Could not share");
    }
  };

  const handleJoin = async () => {
    if (!headers || !route) return;
    try {
      if (route.is_joined) {
        await apiPost(`/api/routes/${route.id}/leave`, {}, headers);
      } else {
        await apiPost(`/api/routes/${route.id}/join`, {}, headers);
      }
      await loadRoute();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleDelete = () => {
    if (!headers || !route) return;
    
    // Web fallback for Alert
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this route? This action cannot be undone.");
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Route",
        "Are you sure you want to delete this route? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  const performDelete = async () => {
    if (!headers || !route) return;
    try {
      await apiDelete(`/api/routes/${route.id}`, headers);
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not delete route");
    }
  };

  const handleEdit = () => {
    if (!route) return;
    setEditTitle(route.title);
    setEditDescription(route.description || "");
    setEditDifficulty(route.difficulty);
    setEditRules(route.rules || "");
    setEditParticipantsMin(String(route.participants_min || 1));
    setEditParticipantsMax(String(route.participants_max || 10));
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!headers || !route) return;
    setEditSaving(true);
    try {
      await apiPut(`/api/routes/${route.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        difficulty: editDifficulty,
        rules: editRules.trim(),
        participants_min: parseInt(editParticipantsMin) || 1,
        participants_max: parseInt(editParticipantsMax) || 10,
      }, headers);
      setShowEditModal(false);
      await loadRoute();
      Alert.alert("Success", "Route updated successfully!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update route");
    } finally {
      setEditSaving(false);
    }
  };

  const loadFriends = async () => {
    if (!headers) return;
    setLoadingFriends(true);
    try {
      const data = await apiGet<Friend[]>("/api/friends", headers);
      setFriends(data);
    } catch (e) {
      console.error("Failed to load friends:", e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleOpenInvite = () => {
    loadFriends();
    setShowInviteModal(true);
  };

  const handleInviteToRoute = async (friendId: string) => {
    if (!headers || !route) return;
    try {
      await apiPost(`/api/routes/${route.id}/invite`, { user_id: friendId }, headers);
      Alert.alert("Success", "Invitation sent!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to send invitation");
    }
  };

  const isCreator = me?.id && route?.created_by === me.id;

  // SVG Map
  const svgData = useMemo(() => {
    if (!route || route.polyline.length < 2) return { points: "", start: null, end: null };
    
    const width = 360;
    const height = 220;
    const pad = 25;
    const w = width - pad * 2;
    const h = height - pad * 2;

    let minLat = route.polyline[0][0], maxLat = route.polyline[0][0];
    let minLng = route.polyline[0][1], maxLng = route.polyline[0][1];
    
    for (const p of route.polyline) {
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    }
    
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);
    
    const pts = route.polyline.map(p => {
      const x = pad + ((p[1] - minLng) / lngSpan) * w;
      const y = pad + (1 - (p[0] - minLat) / latSpan) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    
    const start = route.polyline[0];
    const end = route.polyline[route.polyline.length - 1];
    
    return {
      points: pts,
      start: {
        x: pad + ((start[1] - minLng) / lngSpan) * w,
        y: pad + (1 - (start[0] - minLat) / latSpan) * h,
      },
      end: {
        x: pad + ((end[1] - minLng) / lngSpan) * w,
        y: pad + (1 - (end[0] - minLat) / latSpan) * h,
      },
    };
  }, [route]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Se încarcă...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !route) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error || "Traseu negăsit"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const diffColor = route.difficulty === "easy" ? Colors.success : route.difficulty === "medium" ? "#FFC107" : Colors.danger;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {route.title}
        </Text>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <Svg width={360} height={220}>
            {svgData.points && (
              <SvgPolyline
                points={svgData.points}
                fill="none"
                stroke={Colors.accent}
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {svgData.start && (
              <>
                <Circle cx={svgData.start.x} cy={svgData.start.y} r={14} fill={Colors.success} opacity={0.3} />
                <Circle cx={svgData.start.x} cy={svgData.start.y} r={10} fill={Colors.success} />
              </>
            )}
            {svgData.end && (
              <>
                <Circle cx={svgData.end.x} cy={svgData.end.y} r={14} fill={Colors.danger} opacity={0.3} />
                <Circle cx={svgData.end.x} cy={svgData.end.y} r={10} fill={Colors.danger} />
              </>
            )}
          </Svg>
          
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.legendText}>Finish</Text>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="navigate" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.distance_km.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.duration_min}</Text>
            <Text style={styles.statLabel}>minute</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={Colors.accent} />
            <Text style={styles.statValue}>{route.participants_count}</Text>
            <Text style={styles.statLabel}>participanți</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: diffColor }]}>
            <Ionicons name="speedometer" size={24} color="#FFF" />
            <Text style={[styles.statValue, { color: "#FFF" }]}>
              {route.difficulty === "easy" ? "Ușor" : route.difficulty === "medium" ? "Mediu" : "Greu"}
            </Text>
            <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.8)" }]}>dificultate</Text>
          </View>
        </View>

        {/* Description */}
        {route.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descriere</Text>
            <Text style={styles.description}>{route.description}</Text>
          </View>
        )}

        {/* Cost Estimate */}
        {route.cost_estimate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Estimat</Text>
            <View style={styles.costRow}>
              <View style={styles.costItem}>
                <Ionicons name="flame-outline" size={20} color={Colors.accent} />
                <Text style={styles.costValue}>
                  {route.cost_estimate.fuel.toFixed(0)} {route.cost_estimate.currency}
                </Text>
                <Text style={styles.costLabel}>combustibil</Text>
              </View>
              {route.cost_estimate.tolls > 0 && (
                <View style={styles.costItem}>
                  <Ionicons name="card-outline" size={20} color={Colors.accent} />
                  <Text style={styles.costValue}>
                    {route.cost_estimate.tolls.toFixed(0)} {route.cost_estimate.currency}
                  </Text>
                  <Text style={styles.costLabel}>taxe drum</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Creator Badge with Edit/Delete Buttons */}
        {isCreator && (
          <View style={styles.creatorSection}>
            <View style={styles.creatorCard}>
              <Ionicons name="star" size={20} color={Colors.accent} />
              <Text style={styles.creatorText}>You created this route</Text>
            </View>
            <View style={styles.creatorActions}>
              <Pressable onPress={handleEdit} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={18} color={Colors.accent} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomActions}>
          <Pressable onPress={handleOpenInvite} style={styles.actionIconBtn}>
            <Ionicons name="person-add-outline" size={22} color={Colors.accent} />
          </Pressable>
          <Pressable onPress={handleShare} style={styles.actionIconBtn}>
            <Ionicons name="share-outline" size={22} color={Colors.accent} />
          </Pressable>
        </View>
        <Pressable
          onPress={handleJoin}
          style={[styles.joinButton, route.is_joined && styles.joinButtonJoined]}
        >
          <Ionicons
            name={route.is_joined ? "checkmark-circle" : "add-circle-outline"}
            size={22}
            color={route.is_joined ? Colors.text : Colors.bg}
          />
          <Text style={[styles.joinButtonText, route.is_joined && styles.joinButtonTextJoined]}>
            {route.is_joined ? "Joined" : "Join Route"}
          </Text>
        </Pressable>
      </View>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.inviteModalOverlay}>
          <View style={styles.inviteModalContent}>
            <View style={styles.inviteModalHeader}>
              <Text style={styles.inviteModalTitle}>Invite Friends</Text>
              <Pressable onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            
            {loadingFriends ? (
              <View style={styles.inviteLoading}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.inviteEmpty}>
                <Ionicons name="people-outline" size={48} color={Colors.muted} />
                <Text style={styles.inviteEmptyText}>No friends to invite</Text>
                <Text style={styles.inviteEmptySub}>Add friends to invite them to this route</Text>
              </View>
            ) : (
              <ScrollView style={styles.inviteList}>
                {friends.map((friend) => (
                  <View key={friend.id} style={styles.inviteFriendRow}>
                    <View style={styles.inviteFriendInfo}>
                      {friend.avatar ? (
                        <Image 
                          source={{ uri: friend.avatar.startsWith("data:") ? friend.avatar : `data:image/jpeg;base64,${friend.avatar}` }} 
                          style={styles.inviteFriendAvatar} 
                        />
                      ) : (
                        <View style={styles.inviteFriendAvatarPlaceholder}>
                          <Ionicons name="person" size={18} color={Colors.muted} />
                        </View>
                      )}
                      <Text style={styles.inviteFriendName}>{friend.username}</Text>
                    </View>
                    <Pressable 
                      onPress={() => handleInviteToRoute(friend.id)} 
                      style={styles.inviteSendBtn}
                    >
                      <Ionicons name="paper-plane" size={16} color="#FFF" />
                      <Text style={styles.inviteSendBtnText}>Invite</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.editModal}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Route</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Route title"
                placeholderTextColor={Colors.muted}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.muted}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Difficulty</Text>
              <View style={styles.difficultyPicker}>
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <Pressable
                    key={diff}
                    onPress={() => setEditDifficulty(diff)}
                    style={[
                      styles.difficultyOption,
                      editDifficulty === diff && styles.difficultyOptionActive,
                      diff === "easy" && editDifficulty === diff && { backgroundColor: Colors.success },
                      diff === "medium" && editDifficulty === diff && { backgroundColor: Colors.warning },
                      diff === "hard" && editDifficulty === diff && { backgroundColor: Colors.danger },
                    ]}
                  >
                    <Text style={[
                      styles.difficultyOptionText,
                      editDifficulty === diff && { color: "#FFF" }
                    ]}>
                      {diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Rules</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={editRules}
                onChangeText={setEditRules}
                placeholder="Route rules (optional)"
                placeholderTextColor={Colors.muted}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Participants</Text>
              <View style={styles.participantsRow}>
                <View style={styles.participantInput}>
                  <Text style={styles.participantLabel}>Min</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={editParticipantsMin}
                    onChangeText={setEditParticipantsMin}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <Text style={styles.participantDash}>—</Text>
                <View style={styles.participantInput}>
                  <Text style={styles.participantLabel}>Max</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={editParticipantsMax}
                    onChangeText={setEditParticipantsMax}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSaveEdit}
                disabled={editSaving || !editTitle.trim()}
                style={[
                  styles.saveButton,
                  (editSaving || !editTitle.trim()) && styles.saveButtonDisabled
                ]}
              >
                {editSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </Pressable>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: "Inter_700Bold",
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  centerText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  mapContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    alignItems: "center",
    paddingVertical: 10,
  },
  legend: {
    flexDirection: "row",
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  description: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  costRow: {
    flexDirection: "row",
    gap: 20,
  },
  costItem: {
    alignItems: "center",
    gap: 4,
  },
  costValue: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  costLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  creatorSection: {
    gap: 12,
  },
  creatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  creatorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  creatorActions: {
    flexDirection: "row",
    gap: 12,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  editBtnText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 14,
    padding: 14,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
    paddingBottom: 30,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
  },
  joinButtonJoined: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinButtonText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  joinButtonTextJoined: {
    color: Colors.text,
  },
  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  editModal: {
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
  editModalContent: {
    padding: 20,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  textInput: {
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
  textAreaInput: {
    height: 100,
    textAlignVertical: "top",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  // Difficulty picker styles
  difficultyPicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  difficultyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  difficultyOptionActive: {
    borderColor: "transparent",
  },
  difficultyOptionText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  // Participants row styles
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  participantInput: {
    flex: 1,
  },
  participantLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  numberInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  participantDash: {
    color: Colors.muted,
    fontSize: 16,
    marginTop: 16,
  },
});

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import Svg, { Circle, Rect } from "react-native-svg";
import * as Location from "expo-location";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete, apiPut } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { EventOut } from "../../src/types/api";


import type { UserSearchOut } from "../../src/types/api";
import { InviteFriendsModal } from "../../src/components/InviteFriendsModal";

// Haversine distance calculator
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, me } = useAuthStore();

  const [event, setEvent] = useState<EventOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<UserSearchOut[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Get user location
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        // Web fallback - try to get location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        } catch (e) {
          console.log("Location not available on web");
        }
      } else {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        } catch (e) {
          console.log("Location error", e);
        }
      }
    })();
  }, []);

  // Calculate distance when we have both event and user location
  useEffect(() => {
    if (event && userLocation && event.start_point.length >= 2) {
      const d = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        event.start_point[0],
        event.start_point[1]
      );
      setDistance(d);
    }
  }, [event, userLocation]);

  useEffect(() => {
    loadEvent();
  }, [id]);

  const loadEvent = async () => {
    if (!headers || !id) return;
    setLoading(true);
    try {
      const events = await apiGet<EventOut[]>("/api/events", headers);
      const found = events.find((e) => e.id === id);
      if (found) {
        setEvent(found);
      } else {
        setError("Event not found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading event");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      const dateStr = new Date(event.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      await Share.share({
        message: `🏍️ Moto Event on Moto GO!\n\n📍 ${event.title}\n📅 ${dateStr}\n📌 ${event.location_name || "Location TBD"}\n\n${event.description || "Join us for this amazing moto event!"}`,
        title: event.title,
      });
    } catch (error) {
      Alert.alert("Error", "Could not share event");
    }
  };

  const handleJoin = async () => {
    if (!headers || !event) return;
    try {
      if (event.is_joined) {
        await apiPost(`/api/events/${event.id}/leave`, {}, headers);
      } else {
        await apiPost(`/api/events/${event.id}/join`, {}, headers);
      }
      await loadEvent();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleDelete = () => {
    if (!headers || !event) return;
    
    // Web fallback for Alert
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this event? This action cannot be undone.");
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Event",
        "Are you sure you want to delete this event? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  const performDelete = async () => {
    if (!headers || !event) return;
    try {
      await apiDelete(`/api/events/${event.id}`, headers);
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not delete event");
    }
  };

  const handleEdit = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    // Parse the date
    const eventDate = new Date(event.start_time);
    setEditDate(eventDate.toISOString().split('T')[0]); // YYYY-MM-DD
    setEditTime(eventDate.toTimeString().slice(0, 5)); // HH:MM
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!headers || !event) return;
    setEditSaving(true);
    try {
      // Combine date and time
      const eventDateTime = editDate && editTime 
        ? new Date(`${editDate}T${editTime}:00`) 
        : null;
      
      await apiPut(`/api/events/${event.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        event_date: eventDateTime?.toISOString(),
      }, headers);
      setShowEditModal(false);

  const loadFriends = async () => {
    if (!headers) return;
    setLoadingFriends(true);
    try {
      const data = await apiGet<UserSearchOut[]>("/api/friends", headers);
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

  const handleInviteToEvent = async (friendId: string) => {
    if (!headers || !event) return;
    try {
      await apiPost(`/api/events/${event.id}/invite`, { user_id: friendId }, headers);
      Alert.alert("Succes", "Invitația a fost trimisă!");
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu am putut trimite invitația");
    }
  };

      await loadEvent();
      Alert.alert("Success", "Event updated successfully!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update event");
    } finally {
      setEditSaving(false);
    }
  };

  const openInMaps = () => {
    if (!event || event.start_point.length < 2) return;
    const lat = event.start_point[0];
    const lng = event.start_point[1];
    const label = encodeURIComponent(event.location_name || event.title);
    
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    
    Linking.openURL(url as string);
  };

  const isCreator = me?.id && event?.created_by === me.id;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Past event";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error || "Event not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map Preview */}
        <Pressable onPress={openInMaps} style={styles.mapContainer}>
          <Svg width={360} height={180}>
            {/* Grid pattern */}
            {Array.from({ length: 8 }).map((_, i) => (
              <Rect
                key={`h${i}`}
                x={0}
                y={i * 25}
                width={360}
                height={1}
                fill={Colors.border}
                opacity={0.3}
              />
            ))}
            {Array.from({ length: 15 }).map((_, i) => (
              <Rect
                key={`v${i}`}
                x={i * 25}
                y={0}
                width={1}
                height={180}
                fill={Colors.border}
                opacity={0.3}
              />
            ))}
            
            {/* Center pin */}
            <Circle cx={180} cy={90} r={25} fill={Colors.accent} opacity={0.2} />
            <Circle cx={180} cy={90} r={15} fill={Colors.accent} />
            <Circle cx={180} cy={90} r={5} fill={Colors.bg} />
          </Svg>
          
          {/* Tap to open hint */}
          <View style={styles.mapOverlay}>
            <Ionicons name="navigate" size={16} color={Colors.accent} />
            <Text style={styles.mapOverlayText}>Tap to open in Maps</Text>
          </View>
        </Pressable>

        {/* Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationIconContainer}>
            <Ionicons name="location" size={24} color={Colors.accent} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>LOCATION</Text>
            <Text style={styles.locationName} numberOfLines={2}>
              {event.location_name || "Location not specified"}
            </Text>
            {distance !== null && (
              <View style={styles.distanceRow}>
                <Ionicons name="navigate-outline" size={14} color={Colors.muted} />
                <Text style={styles.distanceText}>
                  {distance < 1 
                    ? `${(distance * 1000).toFixed(0)} m away` 
                    : `${distance.toFixed(1)} km away`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Date & Time Cards */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateCard}>
            <Ionicons name="calendar" size={24} color={Colors.accent} />
            <Text style={styles.dateCardLabel}>DATE</Text>
            <Text style={styles.dateCardValue}>{formatDate(event.start_time)}</Text>
            <View style={styles.daysUntilBadge}>
              <Text style={styles.daysUntilText}>{getDaysUntil(event.start_time)}</Text>
            </View>
          </View>
          <View style={styles.timeCard}>
            <Ionicons name="time" size={24} color={Colors.accent} />
            <Text style={styles.dateCardLabel}>TIME</Text>
            <Text style={styles.dateCardValue}>{formatTime(event.start_time)}</Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.participantsCard}>
          <Ionicons name="people" size={24} color={Colors.accent} />
          <View style={styles.participantsInfo}>
            <Text style={styles.participantsCount}>{event.participants_count}</Text>
            <Text style={styles.participantsLabel}>participants</Text>
          </View>
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this Event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {/* Creator Badge with Edit/Delete Buttons */}
        {isCreator && (
          <View style={styles.creatorSection}>
            <View style={styles.creatorCard}>
              <Ionicons name="star" size={20} color={Colors.accent} />
              <Text style={styles.creatorText}>You created this event</Text>
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
          style={[styles.joinButton, event.is_joined && styles.joinButtonJoined]}
        >
          <Ionicons
            name={event.is_joined ? "checkmark-circle" : "add-circle-outline"}
            size={22}
            color={event.is_joined ? Colors.text : Colors.bg}
          />
          <Text style={[styles.joinButtonText, event.is_joined && styles.joinButtonTextJoined]}>
            {event.is_joined ? "You're Going" : "Join Event"}
          </Text>
        </Pressable>
      </View>

      <InviteFriendsModal
        visible={showInviteModal}
        title="Invită prieteni la eveniment"
        friends={friends}
        loading={loadingFriends}
        onClose={() => setShowInviteModal(false)}
        onInvite={async (friendId) => {
          await handleInviteToEvent(friendId);
        }}
        emptyTitle="Nu ai prieteni de invitat"
        emptySubtitle="Adaugă prieteni ca să îi poți invita la eveniment."
      />

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
              <Text style={styles.editModalTitle}>Edit Event</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.editModalContent}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Event title"
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

              <Text style={styles.inputLabel}>Date & Time</Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateInput}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
                  <TextInput
                    style={styles.dateTimeTextInput}
                    value={editDate}
                    onChangeText={setEditDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.muted}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Ionicons name="time-outline" size={18} color={Colors.muted} />
                  <TextInput
                    style={styles.dateTimeTextInput}
                    value={editTime}
                    onChangeText={setEditTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.muted}
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
            </View>
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
    backgroundColor: Colors.card2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    alignItems: "center",
  },
  mapOverlay: {
    position: "absolute",
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapOverlayText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  locationName: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.card2,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  distanceText: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateCard: {
    flex: 1.5,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  timeCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  dateCardLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  dateCardValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  daysUntilBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  daysUntilText: {
    color: Colors.bg,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  participantsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  participantsInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  participantsCount: {
    color: Colors.text,
    fontSize: 28,
    fontFamily: "Inter_900Black",
  },
  participantsLabel: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
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
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  actionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
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
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  dateInput: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  timeInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  dateTimeTextInput: {
    flex: 1,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});

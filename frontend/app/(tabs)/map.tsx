import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type Report = {
  id: string;
  report_type: string;
  location: number[];
  description?: string;
  reporter_username: string;
  votes_up: number;
  votes_down: number;
  created_at: string;
  expires_at: string;
};

const REPORT_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  police: { icon: "shield", color: "#4A90D9", label: "Police" },
  hazard: { icon: "warning", color: "#FF9500", label: "Hazard" },
  road_closure: { icon: "close-circle", color: "#FF3B30", label: "Road Closed" },
  radar: { icon: "speedometer", color: "#AF52DE", label: "Speed Camera" },
  accident: { icon: "car", color: "#FF2D55", label: "Accident" },
  traffic: { icon: "time", color: "#FFCC00", label: "Traffic" },
};

export default function MapScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [addingReport, setAddingReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      // Default to Bucharest
      setLocation({ lat: 44.4268, lng: 26.1025 });
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }, []);

  const loadReports = useCallback(async () => {
    if (!headers || !location) return;
    try {
      const data = await apiGet<Report[]>(
        `/api/reports?lat=${location.lat}&lng=${location.lng}&radius_km=50`,
        headers
      );
      setReports(data);
    } catch (e) {
      console.error("Failed to load reports:", e);
    }
  }, [headers, location]);

  useEffect(() => {
    loadLocation().finally(() => setLoading(false));
  }, [loadLocation]);

  useEffect(() => {
    if (location) {
      loadReports();
    }
  }, [location, loadReports]);

  const handleAddReport = async (type: string) => {
    if (!headers || !location) return;
    setAddingReport(true);
    try {
      await apiPost(
        "/api/reports",
        {
          report_type: type,
          location: [location.lat, location.lng],
          description: null,
        },
        headers
      );
      setAddModalVisible(false);
      await loadReports();
    } catch (e) {
      console.error("Failed to add report:", e);
    } finally {
      setAddingReport(false);
    }
  };

  const handleVote = async (reportId: string, vote: "up" | "down") => {
    if (!headers) return;
    try {
      await apiPost(`/api/reports/${reportId}/vote?vote=${vote}`, {}, headers);
      await loadReports();
      setSelectedReport(null);
    } catch (e) {
      console.error("Failed to vote:", e);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 0) return "Expiring...";
    if (diffMins < 60) return `${diffMins}m left`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m left`;
  };

  if (loading || !location) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Live Map</Text>
            <Text style={styles.sub}>{reports.length} reports nearby</Text>
          </View>
          <Pressable onPress={() => loadReports()} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={Colors.text} />
          </Pressable>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.lat,
              longitude: location.lng,
              latitudeDelta: 0.15,
              longitudeDelta: 0.15,
            }}
            showsUserLocation
            showsMyLocationButton={false}
            customMapStyle={darkMapStyle}
          >
            {reports.map((r) => {
              const info = REPORT_ICONS[r.report_type] || REPORT_ICONS.hazard;
              return (
                <Marker
                  key={r.id}
                  coordinate={{
                    latitude: r.location[0],
                    longitude: r.location[1],
                  }}
                  onPress={() => setSelectedReport(r)}
                >
                  <View style={[styles.marker, { backgroundColor: info.color }]}>
                    <Ionicons name={info.icon as any} size={16} color="#FFF" />
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {/* My Location Button */}
          <Pressable
            onPress={loadLocation}
            style={styles.myLocationBtn}
          >
            <Ionicons name="locate" size={22} color={Colors.accent} />
          </Pressable>

          {/* Add Report Button */}
          <Pressable
            onPress={() => setAddModalVisible(true)}
            style={styles.addReportBtn}
          >
            <Ionicons name="add" size={24} color={Colors.bg} />
            <Text style={styles.addReportText}>Report</Text>
          </Pressable>
        </View>

        {/* FAB Menu */}
        <View style={styles.fabContainer}>
          {fabExpanded && (
            <>
              <Pressable
                onPress={() => {
                  setFabExpanded(false);
                  router.push("/create/route");
                }}
                style={styles.fabItem}
              >
                <Ionicons name="trail-sign" size={18} color={Colors.bg} />
                <Text style={styles.fabItemText}>New Route</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFabExpanded(false);
                  router.push("/create/event");
                }}
                style={styles.fabItem}
              >
                <Ionicons name="calendar" size={18} color={Colors.bg} />
                <Text style={styles.fabItemText}>New Event</Text>
              </Pressable>
            </>
          )}
          <Pressable
            onPress={() => setFabExpanded(!fabExpanded)}
            style={[styles.fab, fabExpanded && styles.fabActive]}
          >
            <Ionicons
              name={fabExpanded ? "close" : "add"}
              size={28}
              color={Colors.bg}
            />
          </Pressable>
        </View>
      </View>

      {/* Add Report Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Report an issue</Text>
            <Text style={styles.modalSub}>
              Help other riders by reporting what you see
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reportTypes}
            >
              {Object.entries(REPORT_ICONS).map(([type, info]) => (
                <Pressable
                  key={type}
                  onPress={() => handleAddReport(type)}
                  disabled={addingReport}
                  style={styles.reportTypeBtn}
                >
                  <View style={[styles.reportTypeIcon, { backgroundColor: info.color }]}>
                    <Ionicons name={info.icon as any} size={24} color="#FFF" />
                  </View>
                  <Text style={styles.reportTypeLabel}>{info.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {addingReport && (
              <View style={styles.addingOverlay}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReport(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedReport(null)}
        >
          {selectedReport && (
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.reportDetailHeader}>
                <View
                  style={[
                    styles.reportDetailIcon,
                    { backgroundColor: REPORT_ICONS[selectedReport.report_type]?.color || "#FF9500" },
                  ]}
                >
                  <Ionicons
                    name={REPORT_ICONS[selectedReport.report_type]?.icon as any || "warning"}
                    size={28}
                    color="#FFF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportDetailTitle}>
                    {REPORT_ICONS[selectedReport.report_type]?.label || "Report"}
                  </Text>
                  <Text style={styles.reportDetailSub}>
                    by {selectedReport.reporter_username} · {getTimeRemaining(selectedReport.expires_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.voteContainer}>
                <View style={styles.voteInfo}>
                  <Ionicons name="thumbs-up" size={16} color={Colors.success} />
                  <Text style={styles.voteCount}>{selectedReport.votes_up}</Text>
                  <Ionicons name="thumbs-down" size={16} color={Colors.danger} />
                  <Text style={styles.voteCount}>{selectedReport.votes_down}</Text>
                </View>

                <View style={styles.voteButtons}>
                  <Pressable
                    onPress={() => handleVote(selectedReport.id, "up")}
                    style={[styles.voteBtn, styles.voteBtnUp]}
                  >
                    <Ionicons name="thumbs-up" size={18} color="#FFF" />
                    <Text style={styles.voteBtnText}>Still there</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleVote(selectedReport.id, "down")}
                    style={[styles.voteBtn, styles.voteBtnDown]}
                  >
                    <Ionicons name="thumbs-down" size={18} color="#FFF" />
                    <Text style={styles.voteBtnText}>Not there</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: { flex: 1, margin: 16, borderRadius: 20, overflow: "hidden" },
  map: { flex: 1 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  myLocationBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addReportBtn: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.accent,
  },
  addReportText: {
    color: Colors.bg,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  fabContainer: {
    position: "absolute",
    right: 28,
    bottom: 100,
    alignItems: "flex-end",
    gap: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: Colors.danger,
  },
  fabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.accent,
  },
  fabItemText: {
    color: Colors.bg,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
    textAlign: "center",
  },
  modalSub: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  reportTypes: {
    paddingHorizontal: 4,
    gap: 12,
  },
  reportTypeBtn: {
    alignItems: "center",
    gap: 8,
    width: 80,
  },
  reportTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTypeLabel: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  addingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  reportDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  reportDetailIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reportDetailTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  reportDetailSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  voteContainer: {
    gap: 16,
  },
  voteInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  voteCount: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginRight: 8,
  },
  voteButtons: {
    flexDirection: "row",
    gap: 12,
  },
  voteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  voteBtnUp: {
    backgroundColor: Colors.success,
  },
  voteBtnDown: {
    backgroundColor: Colors.danger,
  },
  voteBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

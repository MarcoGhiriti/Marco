import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPut } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

type BikeData = {
  insurance_expiry: string | null;
  itp_expiry: string | null;
  last_service_date: string | null;
  last_service_notes: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
  current_km: number | null;
};

function getStatus(dateStr: string | null): "ok" | "warning" | "expired" | "unknown" {
  if (!dateStr) return "unknown";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days < 30) return "warning";
  return "ok";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `in ${days}d`;
}

const statusColor = (s: string) => {
  if (s === "ok") return Colors.accent;
  if (s === "warning") return Colors.warning;
  if (s === "expired") return Colors.danger;
  return Colors.muted;
};

const statusIcon = (s: string): "checkmark-circle" | "warning" | "alert-circle" | "help-circle" => {
  if (s === "ok") return "checkmark-circle";
  if (s === "warning") return "warning";
  if (s === "expired") return "alert-circle";
  return "help-circle";
};

export default function YourBikeScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [bike, setBike] = useState<BikeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit fields
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [itpExpiry, setItpExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [lastServiceNotes, setLastServiceNotes] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [currentKm, setCurrentKm] = useState("");

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const loadBike = useCallback(async () => {
    if (!headers) return;
    try {
      const data = await apiGet<BikeData>("/api/premium/bike", headers);
      setBike(data);
      setInsuranceExpiry(data.insurance_expiry || "");
      setItpExpiry(data.itp_expiry || "");
      setLastServiceDate(data.last_service_date || "");
      setLastServiceNotes(data.last_service_notes || "");
      setNextServiceKm(data.next_service_km?.toString() || "");
      setCurrentKm(data.current_km?.toString() || "");
    } catch (e) {
      console.error("Load bike error:", e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { loadBike(); }, [loadBike]);

  const handleSave = async () => {
    if (!headers) return;
    setSaving(true);
    try {
      const body: any = {};
      if (insuranceExpiry) body.insurance_expiry = insuranceExpiry;
      if (itpExpiry) body.itp_expiry = itpExpiry;
      if (lastServiceDate) body.last_service_date = lastServiceDate;
      if (lastServiceNotes) body.last_service_notes = lastServiceNotes;
      if (nextServiceKm) body.next_service_km = parseInt(nextServiceKm, 10);
      if (currentKm) body.current_km = parseInt(currentKm, 10);

      const data = await apiPut<BikeData>("/api/premium/bike", body, headers);
      setBike(data);
      setEditing(false);
    } catch (e) {
      console.error("Save bike error:", e);
    } finally {
      setSaving(false);
    }
  };

  const insStatus = getStatus(bike?.insurance_expiry);
  const itpStatus = getStatus(bike?.itp_expiry);
  const svcStatus = bike?.last_service_date ? "ok" : "unknown";

  // Smart Alerts
  const alerts: string[] = [];
  if (itpStatus === "warning" || itpStatus === "expired") {
    alerts.push(`ITP ${daysUntil(bike?.itp_expiry)}`);
  }
  if (insStatus === "warning" || insStatus === "expired") {
    alerts.push(`Insurance ${daysUntil(bike?.insurance_expiry)}`);
  }
  if (bike?.next_service_km && bike?.current_km) {
    const kmLeft = bike.next_service_km - bike.current_km;
    if (kmLeft <= 500 && kmLeft > 0) alerts.push(`Service in ${kmLeft} km`);
    if (kmLeft <= 0) alerts.push("Service overdue");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} data-testid="your-bike-back-btn">
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>YourBike</Text>
        <Pressable
          onPress={() => editing ? handleSave() : setEditing(true)}
          style={styles.editSaveBtn}
          data-testid="your-bike-edit-btn"
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Ionicons name={editing ? "checkmark" : "settings"} size={20} color={Colors.bg} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <>
            {/* Smart Alerts */}
            {alerts.length > 0 && (
              <View style={styles.alertCard} data-testid="smart-alerts-card">
                <View style={styles.alertLeft}>
                  <View style={styles.alertIconBox}>
                    <Ionicons name="warning" size={20} color={Colors.warning} />
                  </View>
                  <View style={styles.alertTextWrap}>
                    <Text style={styles.alertTitle}>Smart Alerts</Text>
                    <Text style={styles.alertText}>{alerts.join(" | ")}</Text>
                  </View>
                </View>
                <Pressable style={styles.manageBtn} onPress={() => setEditing(true)}>
                  <Text style={styles.manageBtnText}>Manage</Text>
                </Pressable>
              </View>
            )}

            {/* Status Cards Row */}
            <View style={styles.statusRow}>
              <View style={[styles.statusCard, { borderColor: statusColor(insStatus) + "55" }]} data-testid="insurance-status-card">
                <Ionicons name={statusIcon(insStatus)} size={28} color={statusColor(insStatus)} />
                <Text style={styles.statusLabel}>Insurance</Text>
                <Text style={[styles.statusDate, { color: statusColor(insStatus) }]}>
                  {formatDate(bike?.insurance_expiry)}
                </Text>
              </View>

              <View style={[styles.statusCard, { borderColor: statusColor(itpStatus) + "55" }]} data-testid="itp-status-card">
                <Ionicons name={statusIcon(itpStatus)} size={28} color={statusColor(itpStatus)} />
                <Text style={styles.statusLabel}>Inspection</Text>
                <Text style={[styles.statusDate, { color: statusColor(itpStatus) }]}>
                  {formatDate(bike?.itp_expiry)}
                </Text>
              </View>

              <View style={[styles.statusCard, { borderColor: statusColor(svcStatus) + "55" }]} data-testid="service-status-card">
                <Ionicons name={statusIcon(svcStatus)} size={28} color={statusColor(svcStatus)} />
                <Text style={styles.statusLabel}>Service</Text>
                <Text style={[styles.statusDate, { color: statusColor(svcStatus) }]}>
                  {bike?.last_service_date ? formatDate(bike.last_service_date) : "Unknown"}
                </Text>
              </View>
            </View>

            {/* Mileage Bar */}
            <View style={styles.mileageCard} data-testid="mileage-card">
              <View style={styles.mileageLeft}>
                <Ionicons name="speedometer" size={22} color={Colors.accent} />
                <Text style={styles.mileageValue}>
                  {bike?.current_km ? bike.current_km.toLocaleString() : "0"} km
                </Text>
              </View>
              <View style={styles.mileageDivider} />
              <View style={styles.mileageRight}>
                <Text style={styles.mileageNextLabel}>Next Service</Text>
                <Text style={styles.mileageNextValue}>
                  {bike?.next_service_km
                    ? `~${(bike.next_service_km - (bike.current_km || 0)).toLocaleString()} km`
                    : "Not set"}
                </Text>
              </View>
            </View>

            {/* Edit Form */}
            {editing && (
              <View style={styles.editSection} data-testid="bike-edit-form">
                <Text style={styles.editSectionTitle}>Update Bike Data</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Insurance Expiry (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={insuranceExpiry}
                    onChangeText={setInsuranceExpiry}
                    placeholder="2026-06-15"
                    placeholderTextColor={Colors.muted}
                    data-testid="input-insurance-expiry"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ITP Expiry (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={itpExpiry}
                    onChangeText={setItpExpiry}
                    placeholder="2026-05-20"
                    placeholderTextColor={Colors.muted}
                    data-testid="input-itp-expiry"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current Mileage (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={currentKm}
                    onChangeText={setCurrentKm}
                    placeholder="5350"
                    placeholderTextColor={Colors.muted}
                    keyboardType="number-pad"
                    data-testid="input-current-km"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Next Service (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={nextServiceKm}
                    onChangeText={setNextServiceKm}
                    placeholder="6000"
                    placeholderTextColor={Colors.muted}
                    keyboardType="number-pad"
                    data-testid="input-next-service-km"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Service Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={lastServiceDate}
                    onChangeText={setLastServiceDate}
                    placeholder="2026-01-10"
                    placeholderTextColor={Colors.muted}
                    data-testid="input-last-service-date"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Service Notes</Text>
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                    value={lastServiceNotes}
                    onChangeText={setLastServiceNotes}
                    placeholder="Oil change, chain adjustment..."
                    placeholderTextColor={Colors.muted}
                    multiline
                    data-testid="input-last-service-notes"
                  />
                </View>

                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving} data-testid="save-bike-btn">
                  {saving ? <ActivityIndicator color={Colors.bg} /> : (
                    <>
                      <Ionicons name="save" size={18} color={Colors.bg} />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Service Notes */}
            {bike?.last_service_notes && !editing && (
              <View style={styles.notesCard} data-testid="service-notes-card">
                <Text style={styles.notesTitle}>Last Service Notes</Text>
                <Text style={styles.notesText}>{bike.last_service_notes}</Text>
              </View>
            )}

            {/* Maintenance Tips Link */}
            <Pressable
              style={styles.tipsCard}
              onPress={() => router.push("/premium/maintenance")}
              data-testid="maintenance-tips-link"
            >
              <View style={styles.tipsIconBox}>
                <Ionicons name="build" size={22} color={Colors.accent} />
              </View>
              <View style={styles.tipsInfo}>
                <Text style={styles.tipsTitle}>Maintenance Tips</Text>
                <Text style={styles.tipsDesc}>Expert care advice for your motorcycle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: Colors.accent, fontSize: 18, fontFamily: "Inter_900Black",
  },
  editSaveBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },

  alertCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.warning}40`,
    borderRadius: 16, padding: 14, gap: 12,
  },
  alertLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  alertIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${Colors.warning}15`, alignItems: "center", justifyContent: "center",
  },
  alertTextWrap: { flex: 1 },
  alertTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  alertText: { color: Colors.warning, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  manageBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  manageBtnText: { color: Colors.text, fontSize: 12, fontFamily: "Inter_700Bold" },

  statusRow: { flexDirection: "row", gap: 10 },
  statusCard: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderRadius: 16,
    padding: 14, alignItems: "center", gap: 8,
  },
  statusLabel: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
  statusDate: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  mileageCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, gap: 16,
  },
  mileageLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  mileageValue: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  mileageDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  mileageRight: { flex: 1, gap: 2 },
  mileageNextLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mileageNextValue: { color: Colors.accent, fontSize: 14, fontFamily: "Inter_700Bold" },

  editSection: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16, gap: 14,
  },
  editSectionTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  inputGroup: { gap: 6 },
  inputLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },
  input: {
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold",
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, marginTop: 4,
  },
  saveBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },

  notesCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 14, gap: 8,
  },
  notesTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  notesText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 },

  tipsCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16,
  },
  tipsIconBox: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  tipsInfo: { flex: 1, gap: 4 },
  tipsTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  tipsDesc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

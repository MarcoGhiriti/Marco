import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
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
import DateTimePicker from "@react-native-community/datetimepicker";
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
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

const statusColor = (s: string) =>
  s === "ok" ? Colors.accent : s === "warning" ? Colors.warning : s === "expired" ? Colors.danger : Colors.muted;

const statusIcon = (s: string): any =>
  s === "ok" ? "checkmark-circle" : s === "warning" ? "warning" : s === "expired" ? "alert-circle" : "help-circle";

export default function YourBikeScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [bike, setBike] = useState<BikeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit fields
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [itpExpiry, setItpExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [lastServiceNotes, setLastServiceNotes] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [currentKm, setCurrentKm] = useState("");

  // Date picker state
  const [activePicker, setActivePicker] = useState<"insurance" | "itp" | "service" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

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

  const openPicker = (field: "insurance" | "itp" | "service") => {
    const val = field === "insurance" ? insuranceExpiry : field === "itp" ? itpExpiry : lastServiceDate;
    setPickerDate(val ? new Date(val) : new Date());
    setActivePicker(field);
  };

  const onPickerChange = (_: any, date?: Date) => {
    if (Platform.OS === "android") setActivePicker(null);
    if (!date) return;
    const iso = date.toISOString().split("T")[0];
    if (activePicker === "insurance") setInsuranceExpiry(iso);
    else if (activePicker === "itp") setItpExpiry(iso);
    else if (activePicker === "service") setLastServiceDate(iso);
    setPickerDate(date);
  };

  const confirmPicker = () => {
    const iso = pickerDate.toISOString().split("T")[0];
    if (activePicker === "insurance") setInsuranceExpiry(iso);
    else if (activePicker === "itp") setItpExpiry(iso);
    else if (activePicker === "service") setLastServiceDate(iso);
    setActivePicker(null);
  };

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
      setShowEditModal(false);
    } catch (e) { console.error("Save bike error:", e); }
    finally { setSaving(false); }
  };

  const insStatus = getStatus(bike?.insurance_expiry);
  const itpStatus = getStatus(bike?.itp_expiry);

  const alerts: string[] = [];
  if (itpStatus === "warning" || itpStatus === "expired") alerts.push(`ITP ${daysUntil(bike?.itp_expiry)}`);
  if (insStatus === "warning" || insStatus === "expired") alerts.push(`Insurance ${daysUntil(bike?.insurance_expiry)}`);
  if (bike?.next_service_km && bike?.current_km) {
    const kmLeft = bike.next_service_km - bike.current_km;
    if (kmLeft <= 500 && kmLeft > 0) alerts.push(`Service in ${kmLeft} km`);
    if (kmLeft <= 0) alerts.push("Service overdue");
  }

  const DateField = ({ label, value, field }: { label: string; value: string; field: "insurance" | "itp" | "service" }) => (
    <View style={styles.dateFieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => openPicker(field)} data-testid={`date-pick-${field}`}>
        <Ionicons name="calendar" size={18} color={Colors.accent} />
        <Text style={styles.dateBtnText}>{value ? formatDate(value) : "Select date"}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} data-testid="your-bike-back-btn">
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>YourBike</Text>
        <Pressable onPress={() => setShowEditModal(true)} style={styles.editBtn} data-testid="your-bike-edit-btn">
          <Ionicons name="settings" size={20} color={Colors.bg} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : (
          <>
            {/* Smart Alerts */}
            {alerts.length > 0 && (
              <View style={styles.alertCard} data-testid="smart-alerts-card">
                <View style={styles.alertIconBox}><Ionicons name="warning" size={20} color={Colors.warning} /></View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertTitle}>Smart Alerts</Text>
                  <Text style={styles.alertText}>{alerts.join(" | ")}</Text>
                </View>
              </View>
            )}

            {/* Status Cards */}
            <View style={styles.statusRow}>
              {[
                { label: "Insurance", status: insStatus, date: bike?.insurance_expiry, icon: "shield-checkmark" as const },
                { label: "ITP", status: itpStatus, date: bike?.itp_expiry, icon: "document-text" as const },
              ].map((c) => (
                <View key={c.label} style={[styles.statusCard, { borderColor: statusColor(c.status) + "44" }]}>
                  <View style={[styles.statusIconWrap, { backgroundColor: statusColor(c.status) + "18" }]}>
                    <Ionicons name={statusIcon(c.status)} size={24} color={statusColor(c.status)} />
                  </View>
                  <Text style={styles.statusLabel}>{c.label}</Text>
                  <Text style={[styles.statusDate, { color: statusColor(c.status) }]}>{formatDate(c.date)}</Text>
                  {c.date && <Text style={[styles.statusDays, { color: statusColor(c.status) }]}>{daysUntil(c.date)}</Text>}
                </View>
              ))}
            </View>

            {/* Mileage */}
            <View style={styles.mileageCard} data-testid="mileage-card">
              <View style={styles.mileageTop}>
                <Ionicons name="speedometer" size={24} color={Colors.accent} />
                <Text style={styles.mileageValue}>{bike?.current_km ? bike.current_km.toLocaleString() : "0"} km</Text>
              </View>
              {bike?.next_service_km && (
                <View style={styles.mileageBar}>
                  <View style={styles.mileageBarTrack}>
                    <View style={[styles.mileageBarFill, {
                      width: `${Math.min(100, Math.max(5, ((bike.current_km || 0) / bike.next_service_km) * 100))}%`,
                    }]} />
                  </View>
                  <Text style={styles.mileageNext}>
                    Next service at {bike.next_service_km.toLocaleString()} km
                    {bike.current_km ? ` (${(bike.next_service_km - bike.current_km).toLocaleString()} km left)` : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Last Service Notes */}
            {bike?.last_service_notes && (
              <View style={styles.notesCard} data-testid="service-notes-card">
                <View style={styles.notesHeader}>
                  <Ionicons name="construct" size={18} color={Colors.accent} />
                  <Text style={styles.notesTitle}>Last Service</Text>
                  {bike.last_service_date && <Text style={styles.notesDate}>{formatDate(bike.last_service_date)}</Text>}
                </View>
                <Text style={styles.notesText}>{bike.last_service_notes}</Text>
              </View>
            )}

            {/* Maintenance Tips Link */}
            <Pressable style={styles.tipsCard} onPress={() => router.push("/premium/maintenance")} data-testid="maintenance-tips-link">
              <View style={styles.tipsIconBox}><Ionicons name="build" size={20} color={Colors.accent} /></View>
              <View style={styles.tipsInfo}>
                <Text style={styles.tipsTitle}>Maintenance Tips</Text>
                <Text style={styles.tipsDesc}>Expert care advice for your motorcycle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="bicycle" size={22} color={Colors.accent} />
                <Text style={styles.modalTitle}>Edit Bike Data</Text>
              </View>
              <Pressable onPress={() => setShowEditModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
              <DateField label="Insurance Expiry" value={insuranceExpiry} field="insurance" />
              <DateField label="ITP Expiry" value={itpExpiry} field="itp" />
              <DateField label="Last Service Date" value={lastServiceDate} field="service" />

              <View style={styles.dateFieldWrap}>
                <Text style={styles.fieldLabel}>Last Service Notes</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                  value={lastServiceNotes}
                  onChangeText={setLastServiceNotes}
                  placeholder="Oil change, chain..."
                  placeholderTextColor={Colors.muted}
                  multiline
                  data-testid="input-service-notes"
                />
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.dateFieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Current km</Text>
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
                <View style={[styles.dateFieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Next service km</Text>
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
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving} data-testid="save-bike-btn">
                {saving ? <ActivityIndicator color={Colors.bg} /> : (
                  <><Ionicons name="checkmark-circle" size={20} color={Colors.bg} /><Text style={styles.saveBtnText}>Save Changes</Text></>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal (iOS) */}
      {activePicker && Platform.OS === "ios" && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {activePicker === "insurance" ? "Insurance Expiry" : activePicker === "itp" ? "ITP Expiry" : "Last Service Date"}
                </Text>
                <Pressable onPress={confirmPicker} style={styles.pickerDoneBtn}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                textColor={Colors.text}
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Date Picker Android (inline) */}
      {activePicker && Platform.OS === "android" && (
        <DateTimePicker value={pickerDate} mode="date" display="default" onChange={onPickerChange} />
      )}

      {/* Date Picker Web fallback */}
      {activePicker && Platform.OS === "web" && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {activePicker === "insurance" ? "Insurance Expiry" : activePicker === "itp" ? "ITP Expiry" : "Last Service Date"}
              </Text>
              <input
                type="date"
                value={pickerDate.toISOString().split("T")[0]}
                onChange={(e: any) => {
                  const d = new Date(e.target.value + "T00:00:00");
                  setPickerDate(d);
                  const iso = d.toISOString().split("T")[0];
                  if (activePicker === "insurance") setInsuranceExpiry(iso);
                  else if (activePicker === "itp") setItpExpiry(iso);
                  else if (activePicker === "service") setLastServiceDate(iso);
                }}
                style={{ fontSize: 18, padding: 12, borderRadius: 12, border: `1px solid ${Colors.border}`, backgroundColor: Colors.card2, color: Colors.text, width: "100%" }}
              />
              <Pressable onPress={() => setActivePicker(null)} style={styles.pickerDoneBtn}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
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
  headerTitle: { color: Colors.accent, fontSize: 18, fontFamily: "Inter_900Black" },
  editBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },

  // Alerts
  alertCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.warning}40`,
    borderRadius: 16, padding: 14,
  },
  alertIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${Colors.warning}15`, alignItems: "center", justifyContent: "center",
  },
  alertInfo: { flex: 1, gap: 2 },
  alertTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  alertText: { color: Colors.warning, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Status Cards
  statusRow: { flexDirection: "row", gap: 12 },
  statusCard: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderRadius: 18,
    padding: 16, alignItems: "center", gap: 8,
  },
  statusIconWrap: {
    width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center",
  },
  statusLabel: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  statusDate: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusDays: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Mileage
  mileageCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 18, gap: 14,
  },
  mileageTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  mileageValue: { color: Colors.text, fontSize: 28, fontFamily: "Inter_900Black" },
  mileageBar: { gap: 6 },
  mileageBarTrack: {
    height: 8, borderRadius: 4, backgroundColor: Colors.card2, overflow: "hidden",
  },
  mileageBarFill: { height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  mileageNext: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Notes
  notesCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 14, gap: 8,
  },
  notesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  notesTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  notesDate: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  notesText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 },

  // Tips
  tipsCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 18, padding: 16,
  },
  tipsIconBox: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: `${Colors.accent}15`, borderWidth: 1, borderColor: `${Colors.accent}35`,
    alignItems: "center", justifyContent: "center",
  },
  tipsInfo: { flex: 1, gap: 4 },
  tipsTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  tipsDesc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Edit Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16,
  },
  saveBtnText: { color: Colors.bg, fontSize: 16, fontFamily: "Inter_900Black" },

  // Date field
  dateFieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  dateBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
  },
  dateBtnText: { color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowFields: { flexDirection: "row", gap: 12 },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold",
  },

  // Date Picker
  pickerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end",
  },
  pickerCard: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 12,
  },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pickerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  pickerDoneBtn: {
    backgroundColor: Colors.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  pickerDoneText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
});

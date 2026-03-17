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
import { useTranslation } from "react-i18next";
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
  bike_name: string | null;
  plate_number: string | null;
  fuel_cost: number | null;
  service_cost: number | null;
  other_cost: number | null;
};

function getStatus(dateStr: string | null): "ok" | "warning" | "expired" | "unknown" {
  if (!dateStr) return "unknown";
  const d = new Date(dateStr);
  const diff = d.getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days < 30) return "warning";
  return "ok";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "";
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

const STATUS_COLORS = {
  ok: { bg: "#1a2e1a", border: "#36F19A", text: Colors.accent, icon: Colors.accent },
  warning: { bg: "#2e2a1a", border: "#F5C542", text: "#F5C542", icon: "#F5C542" },
  expired: { bg: "#2e1a1a", border: "#FF3B30", text: "#FF3B30", icon: "#FF3B30" },
  unknown: { bg: Colors.card, border: Colors.border, text: Colors.muted, icon: Colors.muted },
};

const QUICK_ACTIONS = [
  { icon: "shield-checkmark" as const, label: "Insurance", color: "#7B61FF", action: "insurance" },
  { icon: "construct" as const, label: "Find Service", color: "#1B3A4B", action: "service" },
  { icon: "document-text" as const, label: "Documents", color: "#2196F3", action: "docs" },
  { icon: "notifications" as const, label: "Reminders", color: "#FF9800", action: "reminder" },
];

export default function YourBikeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { accessToken } = useAuthStore();
  const [bike, setBike] = useState<BikeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Edit fields
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [itpExpiry, setItpExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [lastServiceNotes, setLastServiceNotes] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [bikeName, setBikeName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  // Expense fields
  const [fuelCost, setFuelCost] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [otherCost, setOtherCost] = useState("");

  // Date picker
  const [activePicker, setActivePicker] = useState<"insurance" | "itp" | "service" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const headers = useMemo(() => accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, [accessToken]);

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
      setBikeName(data.bike_name || "");
      setPlateNumber(data.plate_number || "");
      setFuelCost(data.fuel_cost?.toString() || "0");
      setServiceCost(data.service_cost?.toString() || "0");
      setOtherCost(data.other_cost?.toString() || "0");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
      if (bikeName) body.bike_name = bikeName;
      if (plateNumber) body.plate_number = plateNumber;
      if (fuelCost) body.fuel_cost = parseFloat(fuelCost);
      if (serviceCost) body.service_cost = parseFloat(serviceCost);
      if (otherCost) body.other_cost = parseFloat(otherCost);
      const data = await apiPut<BikeData>("/api/premium/bike", body, headers);
      setBike(data);
      setShowEditModal(false);
      setShowExpenseModal(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const insStatus = getStatus(bike?.insurance_expiry);
  const itpStatus = getStatus(bike?.itp_expiry);
  const svcStatus = bike?.last_service_date ? "ok" : "unknown";
  const sc = (s: string) => STATUS_COLORS[s as keyof typeof STATUS_COLORS] || STATUS_COLORS.unknown;

  const totalExpenses = (bike?.fuel_cost || 0) + (bike?.service_cost || 0) + (bike?.other_cost || 0);
  const month = new Date().toLocaleString("en-US", { month: "long" });

  const DateField = ({ label, value, field }: { label: string; value: string; field: "insurance" | "itp" | "service" }) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => openPicker(field)}>
        <Ionicons name="calendar" size={18} color={Colors.accent} />
        <Text style={styles.dateBtnText}>{value ? formatDate(value) : "Select date"}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.plateBox}>
          <Ionicons name="bicycle" size={18} color={Colors.accent} />
          <Text style={styles.plateText}>{bike?.plate_number || "Your Bike"}</Text>
        </View>
        <Pressable onPress={() => setShowEditModal(true)} style={styles.editBtn}>
          <Ionicons name="settings-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : (
          <>
            {/* Bike Name + Icon */}
            <View style={styles.bikeHero}>
              <View style={styles.bikeIconWrap}>
                <Ionicons name="bicycle" size={72} color={Colors.accent} />
              </View>
              <Text style={styles.bikeName}>{bike?.bike_name || "My Motorcycle"}</Text>
            </View>

            {/* 3 Status Cards */}
            <View style={styles.statusRow}>
              <Pressable style={[styles.statusCard, { backgroundColor: sc(insStatus).bg, borderColor: sc(insStatus).border }]} onPress={() => { setShowEditModal(true); }}>
                <Ionicons name={insStatus === "ok" ? "checkmark-circle" : insStatus === "warning" ? "warning" : insStatus === "expired" ? "alert-circle" : "help-circle"} size={28} color={sc(insStatus).icon} />
                <Text style={styles.statusTitle}>Insurance</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc(insStatus).border + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: sc(insStatus).text }]}>{formatDate(bike?.insurance_expiry)}</Text>
                </View>
              </Pressable>

              <Pressable style={[styles.statusCard, { backgroundColor: sc(itpStatus).bg, borderColor: sc(itpStatus).border }]} onPress={() => { setShowEditModal(true); }}>
                <Ionicons name={itpStatus === "ok" ? "checkmark-circle" : itpStatus === "warning" ? "warning" : itpStatus === "expired" ? "alert-circle" : "help-circle"} size={28} color={sc(itpStatus).icon} />
                <Text style={styles.statusTitle}>Inspection</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc(itpStatus).border + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: sc(itpStatus).text }]}>{formatDate(bike?.itp_expiry)}</Text>
                </View>
              </Pressable>

              <Pressable style={[styles.statusCard, { backgroundColor: sc(svcStatus).bg, borderColor: sc(svcStatus).border }]} onPress={() => { setShowEditModal(true); }}>
                <Ionicons name="construct" size={28} color={sc(svcStatus).icon} />
                <Text style={styles.statusTitle}>Service</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc(svcStatus).border + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: sc(svcStatus).text }]}>{bike?.last_service_date ? formatDate(bike.last_service_date) : "Unknown"}</Text>
                </View>
              </Pressable>
            </View>

            {/* Mileage Card */}
            <View style={styles.mileageCard}>
              <View style={styles.mileageLeft}>
                <Ionicons name="speedometer" size={24} color={Colors.accent} />
                <View>
                  <Text style={styles.mileageLabel}>Estimated Mileage</Text>
                  <Text style={styles.mileageValue}>{bike?.current_km ? bike.current_km.toLocaleString() : "0"} km</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowEditModal(true)} style={styles.mileageEditBtn}>
                <Ionicons name="create-outline" size={20} color={Colors.accent} />
              </Pressable>
            </View>

            {/* Next Service Card */}
            {bike?.next_service_km && (
              <View style={styles.nextServiceCard}>
                <View style={styles.nextServiceIconBox}>
                  <Ionicons name="construct" size={22} color={Colors.accent} />
                </View>
                <View style={styles.nextServiceInfo}>
                  <Text style={styles.nextServiceTitle}>{t("premium.bike.nextService")}</Text>
                  <Text style={styles.nextServiceValue}>
                    {t("premium.bike.nextServiceAt", { km: bike.next_service_km.toLocaleString() })}
                    {bike.current_km ? ` (${t("premium.bike.kmLeft", { km: (bike.next_service_km - bike.current_km).toLocaleString() })})` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => setShowEditModal(true)}>
                  <Ionicons name="create-outline" size={18} color={Colors.muted} />
                </Pressable>
              </View>
            )}

            {/* Expenses */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Expenses</Text>
              <Pressable onPress={() => setShowExpenseModal(true)}>
                <Text style={styles.sectionLink}>More</Text>
              </Pressable>
            </View>
            <View style={styles.expenseCard}>
              <View style={styles.expenseHeaderRow}>
                <Text style={styles.expenseMonth}>{month}</Text>
                <Text style={styles.expenseTotal}>{totalExpenses.toFixed(2)} EUR</Text>
              </View>
              {[
                { label: "Fuel", value: bike?.fuel_cost || 0, color: "#FF9800" },
                { label: "Service", value: bike?.service_cost || 0, color: "#2196F3" },
                { label: "Other", value: bike?.other_cost || 0, color: Colors.muted },
              ].map((e) => {
                const pct = totalExpenses > 0 ? (e.value / totalExpenses) * 100 : 0;
                return (
                  <View key={e.label} style={styles.expenseRow}>
                    <Text style={styles.expenseLabel}>{e.label}</Text>
                    <View style={styles.expenseBarTrack}>
                      <View style={[styles.expenseBarFill, { width: `${Math.max(2, pct)}%`, backgroundColor: e.color }]} />
                    </View>
                    <Text style={styles.expensePct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
              <Pressable style={styles.addExpenseBtn} onPress={() => setShowExpenseModal(true)}>
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addExpenseText}>Add Expenses</Text>
              </Pressable>
            </View>

            {/* Service Notes */}
            {bike?.last_service_notes && (
              <View style={styles.notesCard}>
                <View style={styles.notesHeaderRow}>
                  <Ionicons name="construct" size={18} color={Colors.accent} />
                  <Text style={styles.notesTitle}>Last Service Notes</Text>
                </View>
                <Text style={styles.notesText}>{bike.last_service_notes}</Text>
              </View>
            )}

            {/* Maintenance Tips */}
            <Pressable style={styles.tipsCard} onPress={() => router.push("/premium/maintenance")}>
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
              <View style={styles.modalHeaderLeft}><Ionicons name="bicycle" size={22} color={Colors.accent} /><Text style={styles.modalTitle}>Edit Bike Data</Text></View>
              <Pressable onPress={() => setShowEditModal(false)} style={styles.modalClose}><Ionicons name="close" size={22} color={Colors.text} /></Pressable>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Bike Name</Text>
                <TextInput style={styles.input} value={bikeName} onChangeText={setBikeName} placeholder="Yamaha MT-07" placeholderTextColor={Colors.muted} />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Plate Number</Text>
                <TextInput style={styles.input} value={plateNumber} onChangeText={setPlateNumber} placeholder="MM-01-ABC" placeholderTextColor={Colors.muted} autoCapitalize="characters" />
              </View>
              <DateField label="Insurance Expiry" value={insuranceExpiry} field="insurance" />
              <DateField label="ITP Expiry" value={itpExpiry} field="itp" />
              <DateField label="Last Service Date" value={lastServiceDate} field="service" />
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Service Notes</Text>
                <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]} value={lastServiceNotes} onChangeText={setLastServiceNotes} placeholder="Oil change, chain..." placeholderTextColor={Colors.muted} multiline />
              </View>
              <View style={styles.rowFields}>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Current km</Text>
                  <TextInput style={styles.input} value={currentKm} onChangeText={setCurrentKm} placeholder="5350" placeholderTextColor={Colors.muted} keyboardType="number-pad" />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Next service km</Text>
                  <TextInput style={styles.input} value={nextServiceKm} onChangeText={setNextServiceKm} placeholder="6000" placeholderTextColor={Colors.muted} keyboardType="number-pad" />
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.bg} /> : (<><Ionicons name="checkmark-circle" size={20} color={Colors.bg} /><Text style={styles.saveBtnText}>Save Changes</Text></>)}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent onRequestClose={() => setShowExpenseModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}><Ionicons name="wallet" size={22} color={Colors.accent} /><Text style={styles.modalTitle}>Add Expenses</Text></View>
              <Pressable onPress={() => setShowExpenseModal(false)} style={styles.modalClose}><Ionicons name="close" size={22} color={Colors.text} /></Pressable>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Fuel (EUR)</Text>
                <TextInput style={styles.input} value={fuelCost} onChangeText={setFuelCost} placeholder="0" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Service (EUR)</Text>
                <TextInput style={styles.input} value={serviceCost} onChangeText={setServiceCost} placeholder="0" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Other (EUR)</Text>
                <TextInput style={styles.input} value={otherCost} onChangeText={setOtherCost} placeholder="0" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.bg} /> : (<><Ionicons name="checkmark-circle" size={20} color={Colors.bg} /><Text style={styles.saveBtnText}>Save Expenses</Text></>)}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date pickers */}
      {activePicker && Platform.OS === "ios" && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{activePicker === "insurance" ? "Insurance Expiry" : activePicker === "itp" ? "ITP Expiry" : "Service Date"}</Text>
                <Pressable onPress={confirmPicker} style={styles.pickerDone}><Text style={styles.pickerDoneText}>Done</Text></Pressable>
              </View>
              <DateTimePicker value={pickerDate} mode="date" display="spinner" onChange={onPickerChange} textColor={Colors.text} themeVariant="dark" />
            </View>
          </View>
        </Modal>
      )}
      {activePicker && Platform.OS === "android" && <DateTimePicker value={pickerDate} mode="date" display="default" onChange={onPickerChange} />}
      {activePicker && Platform.OS === "web" && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>{activePicker === "insurance" ? "Insurance Expiry" : activePicker === "itp" ? "ITP Expiry" : "Service Date"}</Text>
              <input type="date" value={pickerDate.toISOString().split("T")[0]} onChange={(e: any) => { const d = new Date(e.target.value + "T00:00:00"); setPickerDate(d); const iso = d.toISOString().split("T")[0]; if (activePicker === "insurance") setInsuranceExpiry(iso); else if (activePicker === "itp") setItpExpiry(iso); else setLastServiceDate(iso); }} style={{ fontSize: 18, padding: 12, borderRadius: 12, border: `1px solid ${Colors.border}`, backgroundColor: Colors.card2, color: Colors.text, width: "100%" }} />
              <Pressable onPress={() => setActivePicker(null)} style={styles.pickerDone}><Text style={styles.pickerDoneText}>Done</Text></Pressable>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  plateBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  plateText: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  editBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },

  // Bike Hero
  bikeHero: { alignItems: "center", gap: 12, paddingVertical: 8 },
  bikeIconWrap: { width: 140, height: 100, borderRadius: 24, backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.accent}30`, alignItems: "center", justifyContent: "center" },
  bikeName: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },

  // Status Cards
  statusRow: { flexDirection: "row", gap: 10 },
  statusCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: "center", gap: 8 },
  statusTitle: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Mileage
  mileageCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16 },
  mileageLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  mileageLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mileageValue: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  mileageEditBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.accent, alignItems: "center", justifyContent: "center" },

  // Section
  sectionTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLink: { color: Colors.accent, fontSize: 14, fontFamily: "Inter_700Bold" },

  // Quick Actions
  actionsGrid: { flexDirection: "row", gap: 10 },
  actionCard: { flex: 1, borderRadius: 18, padding: 16, alignItems: "center", gap: 10, minHeight: 90, justifyContent: "center" },
  actionLabel: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center" },

  // Services
  servicesRow: { flexDirection: "row", gap: 10 },
  serviceCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  serviceText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },

  // Next Service
  nextServiceCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.accent}30`,
    borderRadius: 18, padding: 16,
  },
  nextServiceIconBox: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: `${Colors.accent}15`, alignItems: "center", justifyContent: "center",
  },
  nextServiceInfo: { flex: 1, gap: 2 },
  nextServiceTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  nextServiceValue: { color: Colors.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Expenses
  expenseCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, gap: 12 },
  expenseHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expenseMonth: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  expenseTotal: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  expenseRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  expenseLabel: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", width: 60 },
  expenseBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.card2 },
  expenseBarFill: { height: 6, borderRadius: 3 },
  expensePct: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold", width: 30, textAlign: "right" },
  addExpenseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  addExpenseText: { color: Colors.accent, fontSize: 14, fontFamily: "Inter_700Bold" },

  // Notes
  notesCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, gap: 8 },
  notesHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notesTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  notesText: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 },

  // Tips
  tipsCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16 },
  tipsIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: `${Colors.accent}15`, borderWidth: 1, borderColor: `${Colors.accent}35`, alignItems: "center", justifyContent: "center" },
  tipsInfo: { flex: 1, gap: 4 },
  tipsTitle: { color: Colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  tipsDesc: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16 },
  saveBtnText: { color: Colors.bg, fontSize: 16, fontFamily: "Inter_900Black" },

  // Fields
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  dateBtnText: { color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowFields: { flexDirection: "row", gap: 12 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Picker
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  pickerCard: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  pickerDone: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  pickerDoneText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
});

/**
 * DateTimePickerField
 * Cross-platform (iOS + Android) date & time picker.
 * - iOS: Opens inline DateTimePicker sheet
 * - Android: Uses DateTimePickerAndroid.open()
 * Shows a tappable row displaying the current value.
 */
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

type Props = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "time";
  minimumDate?: Date;
  testID?: string;
};

export function DateTimePickerField({
  label,
  value,
  onChange,
  mode = "date",
  minimumDate,
  testID,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);

  const displayText =
    mode === "date"
      ? value.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" })
      : value.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  const icon: keyof typeof Ionicons.glyphMap =
    mode === "date" ? "calendar-outline" : "time-outline";

  const handlePress = () => {
    if (Platform.OS === "web") {
      // Web fallback - use native HTML input
      const input = document.createElement("input");
      input.type = mode === "date" ? "date" : "time";
      if (mode === "date") {
        input.value = value.toISOString().split("T")[0];
      } else {
        input.value = `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
      }
      input.style.position = "fixed";
      input.style.top = "-100px";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        if (mode === "date") {
          const parts = input.value.split("-");
          const d = new Date(value);
          d.setFullYear(+parts[0], +parts[1] - 1, +parts[2]);
          onChange(d);
        } else {
          const [h, m] = input.value.split(":").map(Number);
          const d = new Date(value);
          d.setHours(h, m);
          onChange(d);
        }
        document.body.removeChild(input);
      });
      input.showPicker?.();
      input.click();
    } else if (Platform.OS === "android") {
      if (mode === "date") {
        DateTimePickerAndroid.open({
          mode: "date",
          value,
          minimumDate,
          onChange: (_e, selected) => {
            if (selected) onChange(selected);
          },
        });
      } else {
        DateTimePickerAndroid.open({
          mode: "time",
          value,
          is24Hour: true,
          onChange: (_e, selected) => {
            if (selected) onChange(selected);
          },
        });
      }
    } else {
      // iOS: open inline sheet
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={handlePress}
        data-testid={testID ?? `datetime-picker-${mode}`}
      >
        <Ionicons name={icon} size={18} color={Colors.accent} />
        <View style={styles.fieldText}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{displayText}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
      </Pressable>

      {/* iOS picker modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}
        >
          <Pressable style={styles.iosOverlay} onPress={() => setIosOpen(false)}>
            <Pressable style={styles.iosSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.iosSheetHeader}>
                <Text style={styles.iosSheetTitle}>{label}</Text>
                <Pressable
                  onPress={() => setIosOpen(false)}
                  style={styles.iosDoneBtn}
                  data-testid={`${testID ?? `datetime-picker-${mode}`}-done`}
                >
                  <Text style={styles.iosDoneBtnText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode={mode}
                value={value}
                minimumDate={minimumDate}
                display={mode === "date" ? "spinner" : "spinner"}
                onChange={(_e, selected) => {
                  if (selected) onChange(selected);
                }}
                textColor={Colors.text}
                style={styles.iosPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldText: {
    flex: 1,
  },
  fieldLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  fieldValue: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  // iOS sheet
  iosOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  iosSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  iosSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iosSheetTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  iosDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
  },
  iosDoneBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  iosPicker: {
    height: 200,
    alignSelf: "stretch",
  },
});

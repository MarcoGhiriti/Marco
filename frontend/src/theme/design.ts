/**
 * MotoGO Design Tokens — Source of truth: Home screen
 * All screens must reference these constants for consistency.
 */
import { StyleSheet } from "react-native";
import { Colors } from "./colors";

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
  /** Page title — fontSize 22, weight 900 (Inter_900Black) */
  h1: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Inter_900Black",
    letterSpacing: 0.2,
  },
  /** Page subtitle — fontSize 13, weight 600 */
  sub: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  /** Stack screen header title (back-button headers) — fontSize 16, weight 700 */
  stackTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  /** Bottom sheet / modal title — fontSize 18, weight 700 */
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  /** Section headers inside a screen — fontSize 16, weight 800 */
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
  },
  /** Card / list item primary text */
  cardTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  /** Secondary / metadata text */
  cardMeta: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  /** Small label / badge text */
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  /** Tiny text (badges, counters) */
  tiny: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
} as const;

// ─── Header layout ────────────────────────────────────────────────────────────
export const HeaderLayout = StyleSheet.create({
  /** Standard tab-screen header row */
  row: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  /** Stack-screen header (back button + title + actions) */
  stackRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});

// ─── Icon / action buttons ────────────────────────────────────────────────────
export const ButtonTokens = StyleSheet.create({
  /** Default header icon button (outlined card style) */
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Accent / CTA icon button */
  iconBtnAccent: {
    height: 44,
    width: 44,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Small inline action button (e.g. ride controls) */
  iconBtnSm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Full-width primary action button */
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
});

// ─── Cards ────────────────────────────────────────────────────────────────────
export const CardTokens = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
});

// ─── Bottom Sheet / Modal ─────────────────────────────────────────────────────
export const SheetTokens = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
});

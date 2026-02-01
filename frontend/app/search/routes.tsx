import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { Colors } from "../../src/theme/colors";
import { apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, Difficulty } from "../../src/types/api";

const DIFFS: { key: Difficulty | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

export default function RouteSearchScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [onlyPublic, setOnlyPublic] = useState(true);

  const [minKm, setMinKm] = useState("");
  const [maxKm, setMaxKm] = useState("");

  const [afterDate, setAfterDate] = useState("");

  const [results, setResults] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    if (!headers) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<RouteOut[]>("/api/routes", headers);
      let filtered = data;

      const term = q.trim().toLowerCase();
      if (term) {
        filtered = filtered.filter((r) => r.title?.toLowerCase().includes(term));
      }

      if (difficulty !== "all") {
        filtered = filtered.filter((r) => r.difficulty === difficulty);
      }

      if (onlyPublic) {
        // Backend uses privacy settings; we do best-effort: if route has no is_private flag in type, we keep all.
        // TODO: when backend exposes is_private in RouteOut, filter here.
        filtered = filtered;
      }

      const min = minKm.trim() ? Number(minKm) : null;
      const max = maxKm.trim() ? Number(maxKm) : null;
      if (min !== null && !isNaN(min)) filtered = filtered.filter((r) => r.distance_km >= min);
      if (max !== null && !isNaN(max)) filtered = filtered.filter((r) => r.distance_km <= max);

      const after = afterDate.trim() ? new Date(afterDate) : null;
      if (after && !isNaN(after.getTime())) {
        filtered = filtered.filter((r) => {
          if (!r.start_date) return false;
          const d = new Date(r.start_date);
          return !isNaN(d.getTime()) && d >= after;
        });
      }

      setResults(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [afterDate, difficulty, headers, maxKm, minKm, onlyPublic, q]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Search routes</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <View style={styles.inputRow}>
            <Ionicons name="search-outline" size={18} color={Colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Route name"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Difficulty</Text>
          <View style={styles.chipsRow}>
            {DIFFS.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setDifficulty(d.key)}
                style={[styles.chip, difficulty === d.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, difficulty === d.key && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Distance (km)</Text>
          <View style={styles.twoCol}>
            <TextInput
              value={minKm}
              onChangeText={(v) => setMinKm(v.replace(/[^0-9.]/g, ""))}
              placeholder="Min"
              placeholderTextColor={Colors.muted}
              style={[styles.inputRow, styles.twoColInput]}
              keyboardType="decimal-pad"
            />
            <TextInput
              value={maxKm}
              onChangeText={(v) => setMaxKm(v.replace(/[^0-9.]/g, ""))}
              placeholder="Max"
              placeholderTextColor={Colors.muted}
              style={[styles.inputRow, styles.twoColInput]}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>After date</Text>
          <TextInput
            value={afterDate}
            onChangeText={setAfterDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.muted}
            style={styles.inputRow}
            autoCapitalize="none"
          />

          <Pressable onPress={runSearch} style={styles.searchBtn}>
            {loading ? (
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={{ marginTop: 16, gap: 10 }}>
            {results.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/route/${r.id}`)}
                style={styles.resultRow}
              >
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {r.distance_km.toFixed(1)} km · {r.difficulty}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  label: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chipTextActive: {
    color: Colors.bg,
  },
  twoCol: {
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  twoColInput: {
    flex: 1,
  },
  searchBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  errorText: {
    marginTop: 12,
    color: Colors.danger,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  resultRow: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
  },
  resultTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  resultMeta: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

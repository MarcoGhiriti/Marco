import React, { useMemo, useState, useCallback, useEffect } from "react";
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
import Svg, { Polyline as SvgPolyline, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { Colors } from "../../src/theme/colors";
import { apiPost, apiGet } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import { PlaceSearchInput } from "../../src/components/PlaceSearchInput";

interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface RouteInfo {
  polyline: number[][];
  distance_km: number;
  duration_min: number;
  start_address: string;
  end_address: string;
}

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

// SVG Map Preview Component
function RoutePreviewMap({ 
  startPoint, 
  endPoint, 
  polyline 
}: { 
  startPoint: PlaceDetails | null; 
  endPoint: PlaceDetails | null;
  polyline: number[][];
}) {
  const width = 340;
  const height = 200;

  const svgData = useMemo(() => {
    if (polyline.length < 2) {
      // Just show start/end points if no polyline yet
      const points: { lat: number; lng: number }[] = [];
      if (startPoint) points.push({ lat: startPoint.lat, lng: startPoint.lng });
      if (endPoint) points.push({ lat: endPoint.lat, lng: endPoint.lng });
      
      if (points.length === 0) return { points: "", start: null, end: null };
      
      const pad = 20;
      const w = width - pad * 2;
      const h = height - pad * 2;
      
      let minLat = points[0].lat, maxLat = points[0].lat;
      let minLng = points[0].lng, maxLng = points[0].lng;
      
      for (const p of points) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
      }
      
      const latSpan = Math.max(0.01, maxLat - minLat);
      const lngSpan = Math.max(0.01, maxLng - minLng);
      
      const startSvg = startPoint ? {
        x: pad + ((startPoint.lng - minLng) / lngSpan) * w,
        y: pad + (1 - (startPoint.lat - minLat) / latSpan) * h,
      } : null;
      
      const endSvg = endPoint ? {
        x: pad + ((endPoint.lng - minLng) / lngSpan) * w,
        y: pad + (1 - (endPoint.lat - minLat) / latSpan) * h,
      } : null;
      
      return { points: "", start: startSvg, end: endSvg };
    }
    
    // Full polyline rendering
    const pad = 20;
    const w = width - pad * 2;
    const h = height - pad * 2;
    
    let minLat = polyline[0][0], maxLat = polyline[0][0];
    let minLng = polyline[0][1], maxLng = polyline[0][1];
    
    for (const p of polyline) {
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    }
    
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);
    
    const pts = polyline.map(p => {
      const x = pad + ((p[1] - minLng) / lngSpan) * w;
      const y = pad + (1 - (p[0] - minLat) / latSpan) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    
    const start = polyline[0];
    const end = polyline[polyline.length - 1];
    
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
  }, [startPoint, endPoint, polyline]);

  const hasData = startPoint || endPoint || polyline.length > 0;

  return (
    <View style={mapStyles.container}>
      {!hasData ? (
        <View style={mapStyles.placeholder}>
          <Ionicons name="map-outline" size={48} color={Colors.muted} />
          <Text style={mapStyles.placeholderText}>
            Selectează punctul de Start și Finish
          </Text>
        </View>
      ) : (
        <Svg width={width} height={height}>
          {/* Polyline */}
          {svgData.points && (
            <SvgPolyline
              points={svgData.points}
              fill="none"
              stroke={Colors.accent}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          
          {/* Start Point */}
          {svgData.start && (
            <>
              <Circle cx={svgData.start.x} cy={svgData.start.y} r={12} fill={Colors.success} opacity={0.3} />
              <Circle cx={svgData.start.x} cy={svgData.start.y} r={8} fill={Colors.success} />
            </>
          )}
          
          {/* End Point */}
          {svgData.end && (
            <>
              <Circle cx={svgData.end.x} cy={svgData.end.y} r={12} fill={Colors.danger} opacity={0.3} />
              <Circle cx={svgData.end.x} cy={svgData.end.y} r={8} fill={Colors.danger} />
            </>
          )}
        </Svg>
      )}
      
      {/* Legend */}
      {hasData && (
        <View style={mapStyles.legend}>
          <View style={mapStyles.legendItem}>
            <View style={[mapStyles.legendDot, { backgroundColor: Colors.success }]} />
            <Text style={mapStyles.legendText}>Start</Text>
          </View>
          <View style={mapStyles.legendItem}>
            <View style={[mapStyles.legendDot, { backgroundColor: Colors.danger }]} />
            <Text style={mapStyles.legendText}>Finish</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: 200,
    backgroundColor: Colors.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholderText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  legend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    gap: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

export default function CreateRouteScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [startPoint, setStartPoint] = useState<PlaceDetails | null>(null);
  const [endPoint, setEndPoint] = useState<PlaceDetails | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  // Fetch route when both points are selected
  useEffect(() => {
    if (startPoint && endPoint && headers) {
      fetchRoute();
    }
  }, [startPoint, endPoint]);

  const fetchRoute = async () => {
    if (!startPoint || !endPoint || !headers) return;
    
    setLoadingRoute(true);
    setError(null);
    
    try {
      const data = await apiGet(
        `/api/directions/route?origin_lat=${startPoint.lat}&origin_lng=${startPoint.lng}&dest_lat=${endPoint.lat}&dest_lng=${endPoint.lng}`,
        headers
      ) as RouteInfo;
      
      setRouteInfo(data);
    } catch (e) {
      console.error("Route fetch error:", e);
      setError("Nu am putut calcula traseul. Încearcă din nou.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const canProceed = startPoint && endPoint && routeInfo && !loadingRoute;

  const handleCreate = async () => {
    if (!headers || !routeInfo || !title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await apiPost(
        "/api/routes",
        {
          title: title.trim(),
          description: description.trim(),
          polyline: routeInfo.polyline,
          difficulty,
        },
        headers
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la crearea traseului");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Traseu Nou" : "Detalii Traseu"}
          </Text>
          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={!canProceed}
              style={[styles.headerBtn, styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCreate}
              disabled={loading || !title.trim()}
              style={[styles.headerBtn, styles.nextBtn, (loading || !title.trim()) && styles.nextBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.nextBtnText}>Creează</Text>
              )}
            </Pressable>
          )}
        </View>

        {step === 1 ? (
          <ScrollView 
            contentContainerStyle={styles.step1Content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Map Preview */}
            <RoutePreviewMap 
              startPoint={startPoint}
              endPoint={endPoint}
              polyline={routeInfo?.polyline || []}
            />

            {/* Search Inputs */}
            <View style={styles.searchSection}>
              <View style={styles.searchInputWrapper}>
                <PlaceSearchInput
                  label="PUNCT DE START"
                  placeholder="Caută locația de start..."
                  icon="flag"
                  iconColor={Colors.success}
                  onPlaceSelected={(place) => {
                    setStartPoint(place);
                    setRouteInfo(null);
                  }}
                  headers={headers}
                />
              </View>

              <View style={styles.searchInputWrapper}>
                <PlaceSearchInput
                  label="PUNCT DE FINAL"
                  placeholder="Caută destinația..."
                  icon="flag"
                  iconColor={Colors.danger}
                  onPlaceSelected={(place) => {
                    setEndPoint(place);
                    setRouteInfo(null);
                  }}
                  headers={headers}
                />
              </View>
            </View>

            {/* Route Info Card */}
            {loadingRoute && (
              <View style={styles.infoCard}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.infoText}>Se calculează traseul...</Text>
              </View>
            )}

            {routeInfo && !loadingRoute && (
              <View style={styles.routeInfoCard}>
                <View style={styles.routeInfoHeader}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.routeInfoTitle}>Traseu calculat!</Text>
                </View>
                
                <View style={styles.routeStats}>
                  <View style={styles.routeStat}>
                    <Ionicons name="navigate" size={20} color={Colors.accent} />
                    <Text style={styles.routeStatValue}>{routeInfo.distance_km} km</Text>
                    <Text style={styles.routeStatLabel}>Distanță</Text>
                  </View>
                  
                  <View style={styles.routeStatDivider} />
                  
                  <View style={styles.routeStat}>
                    <Ionicons name="time" size={20} color={Colors.accent} />
                    <Text style={styles.routeStatValue}>{routeInfo.duration_min} min</Text>
                    <Text style={styles.routeStatLabel}>Durată</Text>
                  </View>
                </View>

                <View style={styles.addressesSection}>
                  <View style={styles.addressRow}>
                    <View style={[styles.addressDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {startPoint?.name || routeInfo.start_address}
                    </Text>
                  </View>
                  <View style={styles.addressRow}>
                    <View style={[styles.addressDot, { backgroundColor: Colors.danger }]} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {endPoint?.name || routeInfo.end_address}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="warning" size={20} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
            {/* Route Summary */}
            {routeInfo && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
                  <Text style={styles.summaryText}>{routeInfo.distance_km} km</Text>
                  <Ionicons name="time-outline" size={18} color={Colors.accent} style={{ marginLeft: 16 }} />
                  <Text style={styles.summaryText}>{routeInfo.duration_min} min</Text>
                </View>
              </View>
            )}

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Titlu *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Transalpina Weekend"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
                maxLength={80}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Descriere</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Descrie traseul..."
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
                maxLength={800}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Dificultate</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[styles.difficultyBtn, difficulty === d && styles.difficultyBtnActive]}
                  >
                    <Text style={[styles.difficultyBtnText, difficulty === d && styles.difficultyBtnTextActive]}>
                      {d === "easy" ? "Ușor" : d === "medium" ? "Mediu" : "Greu"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {error && <Text style={styles.errorTextSmall}>{error}</Text>}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  nextBtn: { width: 80, backgroundColor: Colors.accent, borderColor: Colors.accent },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: Colors.bg, fontSize: 14, fontFamily: "Inter_700Bold" },
  
  step1Content: { 
    padding: 16,
    gap: 16,
  },
  
  searchSection: {
    gap: 20,
    zIndex: 100,
  },
  searchInputWrapper: {
    zIndex: 100,
  },
  
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
  },
  infoText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  routeInfoCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  routeInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeInfoTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  routeStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card2,
    borderRadius: 12,
    paddingVertical: 16,
  },
  routeStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  routeStatValue: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_900Black",
  },
  routeStatLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  routeStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  addressesSection: {
    gap: 10,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  addressText: {
    flex: 1,
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  
  formContainer: { padding: 16, gap: 12 },
  summaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    padding: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  summaryText: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  formCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  formLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8 },
  formInput: {
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  formTextarea: { height: 100, textAlignVertical: "top" },
  difficultyRow: { flexDirection: "row", gap: 10 },
  difficultyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
  },
  difficultyBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  difficultyBtnText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_700Bold" },
  difficultyBtnTextActive: { color: Colors.bg },
  errorTextSmall: { color: Colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

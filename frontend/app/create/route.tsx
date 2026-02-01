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

type LicenseStatus = {
  license_type: string | null;
  license_verified: boolean;
};

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

// SVG Map Preview Component
function RoutePreviewMap({ 
  startPoint, 
  endPoint, 
  waypoints,
  polyline 
}: { 
  startPoint: PlaceDetails | null; 
  endPoint: PlaceDetails | null;
  waypoints: PlaceDetails[];
  polyline: number[][];
}) {
  const width = 340;
  const height = 200;

  const svgData = useMemo(() => {
    const allPoints: { lat: number; lng: number; type: 'start' | 'end' | 'waypoint' }[] = [];
    if (startPoint) allPoints.push({ lat: startPoint.lat, lng: startPoint.lng, type: 'start' });
    waypoints.forEach(wp => allPoints.push({ lat: wp.lat, lng: wp.lng, type: 'waypoint' }));
    if (endPoint) allPoints.push({ lat: endPoint.lat, lng: endPoint.lng, type: 'end' });

    if (polyline.length >= 2) {
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
      
      // Calculate marker positions
      const markers = allPoints.map(p => ({
        x: pad + ((p.lng - minLng) / lngSpan) * w,
        y: pad + (1 - (p.lat - minLat) / latSpan) * h,
        type: p.type,
      }));
      
      return { points: pts, markers };
    }
    
    // Just show markers without polyline
    if (allPoints.length === 0) return { points: "", markers: [] };
    
    const pad = 20;
    const w = width - pad * 2;
    const h = height - pad * 2;
    
    let minLat = allPoints[0].lat, maxLat = allPoints[0].lat;
    let minLng = allPoints[0].lng, maxLng = allPoints[0].lng;
    
    for (const p of allPoints) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    
    const latSpan = Math.max(0.01, maxLat - minLat);
    const lngSpan = Math.max(0.01, maxLng - minLng);
    
    const markers = allPoints.map(p => ({
      x: pad + ((p.lng - minLng) / lngSpan) * w,
      y: pad + (1 - (p.lat - minLat) / latSpan) * h,
      type: p.type,
    }));
    
    return { points: "", markers };
  }, [startPoint, endPoint, waypoints, polyline]);

  const hasData = startPoint || endPoint || waypoints.length > 0 || polyline.length > 0;

  return (
    <View style={mapStyles.container}>
      {!hasData ? (
        <View style={mapStyles.placeholder}>
          <Ionicons name="map-outline" size={48} color={Colors.muted} />
          <Text style={mapStyles.placeholderText}>
            Select route points
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
          
          {/* Markers */}
          {svgData.markers.map((m, i) => {
            const color = m.type === 'start' ? Colors.success : m.type === 'end' ? Colors.danger : Colors.accent;
            return (
              <React.Fragment key={i}>
                <Circle cx={m.x} cy={m.y} r={12} fill={color} opacity={0.3} />
                <Circle cx={m.x} cy={m.y} r={8} fill={color} />
              </React.Fragment>
            );
          })}
        </Svg>
      )}
      
      {/* Legend */}
      {hasData && (
        <View style={mapStyles.legend}>
          <View style={mapStyles.legendItem}>
            <View style={[mapStyles.legendDot, { backgroundColor: Colors.success }]} />
            <Text style={mapStyles.legendText}>Start</Text>
          </View>
          {waypoints.length > 0 && (
            <View style={mapStyles.legendItem}>
              <View style={[mapStyles.legendDot, { backgroundColor: Colors.accent }]} />
              <Text style={mapStyles.legendText}>Oprire</Text>
            </View>
          )}
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
  const [waypoints, setWaypoints] = useState<PlaceDetails[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minEngineCc, setMinEngineCc] = useState("");

  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // License verification
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [checkingLicense, setCheckingLicense] = useState(true);

  // For adding new waypoint
  const [showWaypointInput, setShowWaypointInput] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const isLicenseVerified = licenseStatus?.license_verified === true;

  // Check license on mount
  useEffect(() => {
    const checkLicense = async () => {
      if (!headers) {
        setCheckingLicense(false);
        return;
      }
      try {
        const data = await apiGet<LicenseStatus>("/api/me/license-status", headers);
        setLicenseStatus(data);
      } catch (e) {
        console.error("Failed to check license:", e);
      } finally {
        setCheckingLicense(false);
      }
    };
    checkLicense();
  }, [headers]);

  // Set default date
  useEffect(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setStartDate(nextWeek.toISOString().split("T")[0]);
    setStartTime("10:00");
  }, []);

  // Fetch route when we have start and end
  useEffect(() => {
    if (startPoint && endPoint && headers) {
      fetchRoute();
    }
  }, [startPoint, endPoint, waypoints]);

  const fetchRoute = async () => {
    if (!startPoint || !endPoint || !headers) return;
    
    setLoadingRoute(true);
    setError(null);
    
    try {
      // Build waypoints string for API
      let url = `/api/directions/route?origin_lat=${startPoint.lat}&origin_lng=${startPoint.lng}&dest_lat=${endPoint.lat}&dest_lng=${endPoint.lng}`;
      
      // Add waypoints if any
      if (waypoints.length > 0) {
        const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
        url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
      }
      
      const data = await apiGet(url, headers) as RouteInfo;
      setRouteInfo(data);
    } catch (e) {
      console.error("Route fetch error:", e);
      setError("Could not calculate route. Try again.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const addWaypoint = (place: PlaceDetails) => {
    setWaypoints([...waypoints, place]);
    setShowWaypointInput(false);
    setRouteInfo(null); // Reset to trigger recalculation
  };

  const removeWaypoint = (index: number) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
    setRouteInfo(null);
  };

  const canProceed = startPoint && endPoint && routeInfo && !loadingRoute;

  const handleCreate = async () => {
    if (!headers || !routeInfo || !title.trim() || !startDate || !startTime) return;

    setLoading(true);
    setError(null);
    try {
      const startDateTime = new Date(`${startDate}T${startTime}:00`);
      if (isNaN(startDateTime.getTime())) {
        setError("Invalid date/time format");
        setLoading(false);
        return;
      }

      await apiPost(
        "/api/routes",
        {
          title: title.trim(),
          description: description.trim(),
          polyline: routeInfo.polyline,
          difficulty,
          stops_count: waypoints.length,
          start_point: startPoint ? [startPoint.lat, startPoint.lng] : null,
          end_point: endPoint ? [endPoint.lat, endPoint.lng] : null,
          waypoints: waypoints.map((w) => ({
            name: w.name,
            address: w.address,
            lat: w.lat,
            lng: w.lng,
          })),
          min_engine_cc: minEngineCc.trim() ? Number(minEngineCc.trim()) : null,
          start_date: startDateTime.toISOString(),
        },
        headers
      );
      // Navigate to Profile so user can immediately see it in "My Routes"
      router.replace("/(tabs)/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creating route");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking license
  if (checkingLicense) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Checking license...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show blocked screen if license not verified
  if (!isLicenseVerified) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>New Route</Text>
          <View style={{ width: 44 }} />
        </View>
        
        <View style={styles.blockedContainer}>
          <View style={styles.blockedIcon}>
            <Ionicons name="shield-checkmark" size={64} color={Colors.warning} />
          </View>
          <Text style={styles.blockedTitle}>License Required</Text>
          <Text style={styles.blockedText}>
            To create routes and track kilometers, you need to verify your motorcycle license (A1, A2, or A).
          </Text>
          <Pressable 
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.verifyBtn}
          >
            <Ionicons name="card" size={20} color={Colors.bg} />
            <Text style={styles.verifyBtnText}>Verify License</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
            {step === 1 ? "New Route" : "Route Details"}
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
                <Text style={styles.nextBtnText}>Create</Text>
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
              waypoints={waypoints}
              polyline={routeInfo?.polyline || []}
            />

            {/* Search Inputs */}
            <View style={styles.searchSection}>
              {/* Start Point */}
              <View style={styles.searchInputWrapper}>
                <PlaceSearchInput
                  label="START POINT"
                  placeholder="Search for start location..."
                  icon="flag"
                  iconColor={Colors.success}
                  onPlaceSelected={(place) => {
                    setStartPoint(place);
                    setRouteInfo(null);
                  }}
                  headers={headers}
                />
              </View>

              {/* Waypoints */}
              {waypoints.map((wp, index) => (
                <View key={index} style={styles.waypointItem}>
                  <View style={styles.waypointInfo}>
                    <View style={styles.waypointIcon}>
                      <Ionicons name="location" size={16} color={Colors.accent} />
                      <Text style={styles.waypointNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.waypointText}>
                      <Text style={styles.waypointName} numberOfLines={1}>{wp.name}</Text>
                      <Text style={styles.waypointAddress} numberOfLines={1}>{wp.address}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => removeWaypoint(index)} style={styles.removeWaypointBtn}>
                    <Ionicons name="close-circle" size={22} color={Colors.danger} />
                  </Pressable>
                </View>
              ))}

              {/* Add Waypoint */}
              {showWaypointInput ? (
                <View style={styles.searchInputWrapper}>
                  <PlaceSearchInput
                    label={`STOP ${waypoints.length + 1}`}
                    placeholder="Search city or location..."
                    icon="location"
                    iconColor={Colors.accent}
                    onPlaceSelected={addWaypoint}
                    headers={headers}
                  />
                  <Pressable 
                    onPress={() => setShowWaypointInput(false)} 
                    style={styles.cancelWaypointBtn}
                  >
                    <Text style={styles.cancelWaypointText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable 
                  onPress={() => setShowWaypointInput(true)} 
                  style={styles.addWaypointBtn}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
                  <Text style={styles.addWaypointText}>Add intermediate stop</Text>
                </Pressable>
              )}

              {/* End Point */}
              <View style={styles.searchInputWrapper}>
                <PlaceSearchInput
                  label="END POINT"
                  placeholder="Search for destination..."
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
                <Text style={styles.infoText}>Calculating route...</Text>
              </View>
            )}

            {routeInfo && !loadingRoute && (
              <View style={styles.routeInfoCard}>
                <View style={styles.routeInfoHeader}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.routeInfoTitle}>Route calculated!</Text>
                </View>
                
                <View style={styles.routeStats}>
                  <View style={styles.routeStat}>
                    <Ionicons name="navigate" size={20} color={Colors.accent} />
                    <Text style={styles.routeStatValue}>{routeInfo.distance_km} km</Text>
                    <Text style={styles.routeStatLabel}>Distance</Text>
                  </View>
                  
                  <View style={styles.routeStatDivider} />
                  
                  <View style={styles.routeStat}>
                    <Ionicons name="time" size={20} color={Colors.accent} />
                    <Text style={styles.routeStatValue}>{routeInfo.duration_min} min</Text>
                    <Text style={styles.routeStatLabel}>Duration</Text>
                  </View>

                  {waypoints.length > 0 && (
                    <>
                      <View style={styles.routeStatDivider} />
                      <View style={styles.routeStat}>
                        <Ionicons name="flag" size={20} color={Colors.accent} />
                        <Text style={styles.routeStatValue}>{waypoints.length}</Text>
                        <Text style={styles.routeStatLabel}>Stops</Text>
                      </View>
                    </>
                  )}
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
                  {waypoints.length > 0 && (
                    <>
                      <Ionicons name="flag-outline" size={18} color={Colors.accent} style={{ marginLeft: 16 }} />
                      <Text style={styles.summaryText}>{waypoints.length} stops</Text>
                    </>
                  )}
                </View>
              </View>
            )}

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="E.g.: Transalpina Weekend"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
                maxLength={80}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the route..."
                placeholderTextColor={Colors.muted}
                style={[styles.formInput, styles.formTextarea]}
                multiline
                maxLength={800}
              />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Ride Date & Time *</Text>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.muted}
                    style={styles.dateTimeInput}
                  />
                </View>
                <View style={styles.dateTimeField}>
                  <Ionicons name="time-outline" size={18} color={Colors.muted} />
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.muted}
                    style={styles.dateTimeInput}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[styles.difficultyBtn, difficulty === d && styles.difficultyBtnActive]}
                  >
                    <Text style={[styles.difficultyBtnText, difficulty === d && styles.difficultyBtnTextActive]}>
                      {d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard"}
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
  
  // Center loading
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
  
  // Blocked screen
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 20,
  },
  blockedIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,193,7,0.15)",
    alignItems: "center",

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Minimum engine size (cc)</Text>
              <TextInput
                value={minEngineCc}
                onChangeText={(v) => setMinEngineCc(v.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 600"
                placeholderTextColor={Colors.muted}
                style={styles.formInput}
                keyboardType="number-pad"
              />
              <Text style={styles.formHint}>
                Riders with a smaller bike CC won't be able to join.
              </Text>
            </View>

    justifyContent: "center",
  },
  blockedTitle: {
    color: Colors.warning,
    fontSize: 24,
    fontFamily: "Inter_900Black",
  },
  blockedText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  verifyBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  
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
    gap: 16,
    zIndex: 100,
  },
  searchInputWrapper: {
    zIndex: 100,
  },

  // Waypoints
  waypointItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  waypointInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waypointIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  waypointNumber: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: Colors.accent,
    color: Colors.bg,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  waypointText: {
    flex: 1,
  },
  waypointName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  waypointAddress: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  removeWaypointBtn: {
    padding: 4,
  },

  addWaypointBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
  },
  addWaypointText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cancelWaypointBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelWaypointText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
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
  dateTimeRow: { flexDirection: "row", gap: 10 },
  dateTimeField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  dateTimeInput: { flex: 1, height: 44, color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
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

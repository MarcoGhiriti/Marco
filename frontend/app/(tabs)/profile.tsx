import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeTabBarHeight } from "../../src/hooks/useSafeTabBarHeight";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Colors } from "../../src/theme/colors";
import { apiGet, apiPost, apiDelete } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";
import type { RouteOut, RideSessionOut, EventOut } from "../../src/types/api";
import { RouteMiniMap } from "../../src/components/RouteMiniMap";
import { PremiumBadge } from "../../src/components/PremiumBadge";

type Stats = {
  km_total: number;
  km_month: number;
  joined_routes: number;
  events_joined: number;
  completed_routes: number;
};

type Friend = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

type LicenseStatus = {
  license_type: string | null;
  license_verified: boolean;
  license_submitted_at: string | null;
};

// Calculate level based on kilometers
function calculateLevel(kmTotal: number): { level: number; title: string; nextKm: number; progress: number } {
  const levels = [
    { level: 1, title: "Rookie", minKm: 0, maxKm: 100 },
    { level: 2, title: "Explorer", minKm: 100, maxKm: 500 },
    { level: 3, title: "Adventurer", minKm: 500, maxKm: 1000 },
    { level: 4, title: "Road Warrior", minKm: 1000, maxKm: 2500 },
    { level: 5, title: "Highway King", minKm: 2500, maxKm: 5000 },
    { level: 6, title: "Moto Master", minKm: 5000, maxKm: 10000 },
    { level: 7, title: "Legend", minKm: 10000, maxKm: 25000 },
    { level: 8, title: "Immortal", minKm: 25000, maxKm: 50000 },
    { level: 9, title: "God of Roads", minKm: 50000, maxKm: 100000 },
    { level: 10, title: "Mythical", minKm: 100000, maxKm: Infinity },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (kmTotal >= levels[i].minKm) {
      const current = levels[i];
      const progress = current.maxKm === Infinity 
        ? 100 
        : Math.min(100, ((kmTotal - current.minKm) / (current.maxKm - current.minKm)) * 100);
      return {
        level: current.level,
        title: current.title,
        nextKm: current.maxKm === Infinity ? 0 : current.maxKm,
        progress,
      };
    }
  }
  return { level: 1, title: "Rookie", nextKm: 100, progress: 0 };
}

function Row({
  title,
  subtitle,
  leftIcon,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  leftIcon: React.ComponentProps<typeof Ionicons>["name"];
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={leftIcon} size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={Colors.muted} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { accessToken, me, logout, refreshMe } = useAuthStore();
  const tabBarHeight = useSafeTabBarHeight();

  const [stats, setStats] = useState<Stats | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteOut[]>([]);
  const [myEvents, setMyEvents] = useState<EventOut[]>([]);
  const [activeRide, setActiveRide] = useState<RideSessionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "events">("routes");
  const [showMyContent, setShowMyContent] = useState(false); // Collapsed by default
  
  // License verification state
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>("A");
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!headers) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await refreshMe();
      const [statsData, friendsData, routesData, eventsData, rideData, licenseData] = await Promise.all([
        apiGet<Stats>("/api/stats", headers),
        apiGet<Friend[]>("/api/friends", headers),
        apiGet<RouteOut[]>("/api/routes/my", headers),
        apiGet<EventOut[]>("/api/events/my", headers),
        apiGet<RideSessionOut | null>("/api/rides/active", headers).catch(() => null),
        apiGet<LicenseStatus>("/api/me/license-status", headers).catch(() => null),
      ]);
      setStats(statsData);
      setFriends(friendsData);
      setMyRoutes(routesData);
      setMyEvents(eventsData);
      setActiveRide(rideData);
      setLicenseStatus(licenseData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [headers, refreshMe]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch data when screen is focused (fixes stale data after route/event deletion)
  useFocusEffect(
    useCallback(() => {
      if (headers) load();
    }, [headers])
  );

  const pickLicensePhoto = async () => {
    if (Platform.OS === "web") {
      // Web: use file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setLicensePhoto(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        setLicensePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    }
  };

  const submitLicense = async () => {
    if (!headers || !licensePhoto) return;
    setUploadingLicense(true);
    try {
      await apiPost("/api/me/license", {
        license_type: selectedLicenseType,
        license_photo_base64: licensePhoto,
      }, headers);
      Alert.alert("Success", "Your license has been submitted for verification!");
      setShowLicenseModal(false);
      setLicensePhoto(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit license");
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleStartRide = async (routeId: string) => {
    if (!headers) return;
    try {
      const data = await apiPost<RideSessionOut>("/api/rides/start", { route_id: routeId }, headers);
      setActiveRide(data);
      Alert.alert("Ride Started!", "Your ride has begun. Drive safe!");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not start ride");
    }
  };

  const handleEndRide = async () => {
    if (!headers || !activeRide) return;
    try {
      await apiPost("/api/rides/end", { session_id: activeRide.id }, headers);
      setActiveRide(null);
      Alert.alert("Ride Completed!", "Congrats! Your kilometers have been recorded.");
      load(); // Refresh to update stats and remove the route
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not end ride");
    }
  };

  const motoLine = me?.bike?.model 
    ? `${me.bike.model}${me.bike?.cc ? ` · ${me.bike.cc}cc` : ""}` 
    : t("profile.motorcycleNotSet");
  const country = me?.country ? me.country : t("profile.countryNotSet");

  const levelInfo = calculateLevel(stats?.km_total ?? 0);

  const personalStatsSection = (
    <View style={styles.section} data-testid="profile-personal-stats-section">
      <Text style={styles.sectionTitle}>{t("profile.personalStats")}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>{Math.round(stats?.km_total ?? 0)}</Text>
            <Text style={styles.statLabel}>{t("profile.totalKmLabel")}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>{Math.round(stats?.km_month ?? 0)}</Text>
            <Text style={styles.statLabel}>{t("profile.thisMonth")}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trail-sign-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>{stats?.completed_routes ?? 0}</Text>
            <Text style={styles.statLabel}>{t("profile.routesLabel")}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="ticket-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>{stats?.events_joined ?? 0}</Text>
            <Text style={styles.statLabel}>{t("profile.eventsLabel")}</Text>
          </View>
        </View>
      )}

      <Text style={styles.statsNote}>{t("profile.statsNote")}</Text>
    </View>
  );

  const premiumSection = (
    <Pressable
      style={styles.premiumGoCard}
      onPress={() => router.push("/premium")}
      data-testid="go-premium-btn"
    >
      <View style={styles.premiumGoGlow} />
      <View style={styles.premiumGoIconBox}>
        <Ionicons name="diamond" size={28} color={Colors.accent} />
      </View>
      <View style={styles.premiumGoInfo}>
        <Text style={styles.premiumGoTitle}>MotoGO Premium</Text>
        <Text style={styles.premiumGoSub}>Your Bike, Free Ride, Tips & more</Text>
      </View>
      <View style={styles.premiumGoPriceBox}>
        <Text style={styles.premiumGoPrice}>{"\u20AC"}4.99</Text>
        <Text style={styles.premiumGoPricePer}>/mo</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 20 }]}>
        <View style={styles.header}>
          <Text style={styles.h1}>{t("profile.title")}</Text>
          <Text style={styles.sub}>{t("profile.subtitle")}</Text>
        </View>

        {/* PROFILE HEADER */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {me?.profile_photo_base64 ? (
                <Image
                  source={{ uri: me.profile_photo_base64 }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={22} color={Colors.text} />
              )}
            </View>
            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelInfo.level}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.username}>{me?.username ?? ""}</Text>
              {me?.premium && <PremiumBadge size="md" />}
            </View>
            <Text style={styles.levelTitle}>{levelInfo.title}</Text>
            <Text style={styles.meta}>{motoLine}</Text>
            <Text style={styles.meta}>{country}</Text>
          </View>
          <Pressable onPress={() => router.push("/profile/edit")} style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color={Colors.text} />
          </Pressable>
        </View>

        {premiumSection}

        {personalStatsSection}

        {/* LEVEL PROGRESS */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelIconBox}>
              <Ionicons name="trophy" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelCardTitle}>{t("profile.level")} {levelInfo.level} · {levelInfo.title}</Text>
              <Text style={styles.levelCardSub}>
                {levelInfo.nextKm > 0 
                  ? `${Math.round(stats?.km_total ?? 0)} / ${levelInfo.nextKm} km`
                  : t("profile.maxLevel") || "Maximum level reached!"}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${levelInfo.progress}%` }]} />
          </View>
        </View>

        {/* FRIENDS COUNTER */}
        <Pressable 
          onPress={() => router.push("/profile/friends")} 
          style={styles.friendsCard}
        >
          <View style={styles.friendsLeft}>
            <View style={styles.friendsIconBox}>
              <Ionicons name="people" size={20} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.friendsCount}>{friends.length}</Text>
              <Text style={styles.friendsLabel}>{t("profile.friends")}</Text>
            </View>
          </View>
          <View style={styles.friendsPreview}>
            {friends.slice(0, 3).map((f, i) => (
              <View 
                key={f.id} 
                style={[
                  styles.friendMiniAvatar, 
                  { marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i }
                ]}
              >
                {f.profile_photo_base64 ? (
                  <Image source={{ uri: f.profile_photo_base64 }} style={styles.friendMiniImage} />
                ) : (
                  <Ionicons name="person" size={12} color={Colors.muted} />
                )}
              </View>
            ))}
            {friends.length > 3 && (
              <View style={[styles.friendMiniAvatar, styles.friendMoreBadge, { marginLeft: -10 }]}>
                <Text style={styles.friendMoreText}>+{friends.length - 3}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </Pressable>

        {/* LICENSE VERIFICATION */}
        <Pressable onPress={() => setShowLicenseModal(true)} style={styles.licenseCard}>
          <View style={styles.licenseIconBox}>
            <Ionicons 
              name={licenseStatus?.license_verified ? "shield-checkmark" : "card"} 
              size={24} 
              color={licenseStatus?.license_verified ? Colors.success : Colors.accent} 
            />
          </View>
          <View style={styles.licenseInfo}>
            <Text style={styles.licenseTitle}>
              {licenseStatus?.license_verified 
                ? `${t("profile.licenseVerified")} (${licenseStatus.license_type})` 
                : licenseStatus?.license_type 
                  ? t("profile.verificationPending")
                  : t("profile.verifyYourLicense")}
            </Text>
            <Text style={styles.licenseSub}>
              {licenseStatus?.license_verified 
                ? t("profile.kmTrackingEnabled")
                : licenseStatus?.license_type 
                  ? t("profile.underReview")
                  : t("profile.requiredForRanking")}
            </Text>
          </View>
          <View style={[
            styles.licenseStatus,
            licenseStatus?.license_verified && styles.licenseStatusVerified,
            licenseStatus?.license_type && !licenseStatus?.license_verified && styles.licenseStatusPending,
          ]}>
            <Text style={[
              styles.licenseStatusText,
              licenseStatus?.license_verified && styles.licenseStatusTextVerified,
            ]}>
              {licenseStatus?.license_verified 
                ? "✓" 
                : licenseStatus?.license_type 
                  ? "⏳"
                  : "→"}
            </Text>
          </View>
        </Pressable>

        {/* RANKINGS & BADGES */}
        <View style={styles.rankingsSection}>
          <Pressable 
            onPress={() => router.push("/(tabs)/store")} 
            style={styles.rankingCard}
          >
            <View style={styles.rankingIconBox}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
            </View>
            <View style={styles.rankingInfo}>
              <Text style={styles.rankingTitle}>{t("profile.rankingsAndBadges")}</Text>
              <Text style={styles.rankingSub}>{t("profile.viewLeaderboard")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </Pressable>
        </View>

        {/* MY CONTENT - Expandable Section */}
        <View style={styles.section}>
          <Pressable 
            onPress={() => setShowMyContent(!showMyContent)} 
            style={styles.myContentHeader}
          >
            <View style={styles.myContentHeaderLeft}>
              <View style={styles.myContentIconBox}>
                <Ionicons name="folder-open" size={20} color={Colors.accent} />
              </View>
              <View>
                <Text style={styles.myContentTitle}>{t("profile.myCreatedContent")}</Text>
                <Text style={styles.myContentSub}>
                  {myRoutes.length} routes · {myEvents.length} events
                </Text>
              </View>
            </View>
            <Ionicons 
              name={showMyContent ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={Colors.muted} 
            />
          </Pressable>

          {showMyContent && (
            <>
              <View style={styles.tabSwitcher}>
                <Pressable 
                  onPress={() => setActiveTab("routes")} 
                  style={[styles.tabBtn, activeTab === "routes" && styles.tabBtnActive]}
                >
                  <Ionicons name="map" size={18} color={activeTab === "routes" ? Colors.accent : Colors.muted} />
                  <Text style={[styles.tabBtnText, activeTab === "routes" && styles.tabBtnTextActive]}>
                    {t("profile.myRoutes")} ({myRoutes.length})
                  </Text>
                </Pressable>
                <Pressable 
                  onPress={() => setActiveTab("events")} 
                  style={[styles.tabBtn, activeTab === "events" && styles.tabBtnActive]}
                >
                  <Ionicons name="calendar" size={18} color={activeTab === "events" ? Colors.accent : Colors.muted} />
                  <Text style={[styles.tabBtnText, activeTab === "events" && styles.tabBtnTextActive]}>
                    {t("profile.myEvents")} ({myEvents.length})
                  </Text>
                </Pressable>
              </View>

              {/* Create Button */}
              <Pressable 
                onPress={() => router.push(activeTab === "routes" ? "/create/route" : "/create/event")} 
                style={styles.createContentBtn}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.createContentBtnText}>
                  {activeTab === "routes" ? t("profile.createRoute") : t("profile.createEvent")}
                </Text>
              </Pressable>

              {/* Routes Tab Content */}
              {activeTab === "routes" && (
                <>
                  {myRoutes.length === 0 ? (
                    <View style={styles.emptyRoutes}>
                      <Ionicons name="map-outline" size={48} color={Colors.muted} />
                      <Text style={styles.emptyRoutesText}>{t("profile.noRoutesCreated")}</Text>
                      <Text style={styles.emptyRoutesSub}>{t("profile.createFirstRoute")}</Text>
                    </View>
                  ) : (
                    <View style={styles.myRoutesList}>
                      {myRoutes.map((route) => {
                        const isActiveRoute = activeRide?.route_id === route.id;
                        
                        return (
                          <Pressable 
                            key={route.id} 
                            onPress={() => router.push(`/route/${route.id}`)}
                            style={styles.myRouteCard}
                          >
                            <RouteMiniMap polyline={route.polyline} />
                            <View style={styles.myRouteContent}>
                              <Text style={styles.myRouteTitle} numberOfLines={1}>{route.title}</Text>
                              <View style={styles.myRouteStats}>
                                <Text style={styles.myRouteStat}>
                                  <Ionicons name="navigate-outline" size={12} color={Colors.accent} /> {route.distance_km.toFixed(1)} km
                                </Text>
                                <Text style={styles.myRouteStat}>
                                  <Ionicons name="people-outline" size={12} color={Colors.accent} /> {route.participants_count}
                                </Text>
                              </View>
                              
                              {/* Action Buttons */}
                              <View style={styles.myRouteActions}>
                                {isActiveRoute ? (
                                  <Pressable onPress={handleEndRide} style={styles.endRideBtn}>
                                    <Ionicons name="flag" size={16} color="#FFF" />
                                    <Text style={styles.endRideBtnText}>End</Text>
                                  </Pressable>
                                ) : !activeRide ? (
                                  <Pressable onPress={() => handleStartRide(route.id)} style={styles.startRideBtn}>
                                    <Ionicons name="play" size={16} color="#FFF" />
                                    <Text style={styles.startRideBtnText}>Start</Text>
                                  </Pressable>
                                ) : (
                                  <View style={styles.rideLocked}>
                                    <Ionicons name="lock-closed" size={14} color={Colors.muted} />
                                  </View>
                                )}
                                <Pressable 
                                  onPress={() => router.push(`/route/${route.id}`)} 
                                  style={styles.editRouteBtn}
                                >
                                  <Ionicons name="create-outline" size={16} color={Colors.accent} />
                                </Pressable>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Events Tab Content */}
              {activeTab === "events" && (
                <>
                  {myEvents.length === 0 ? (
                    <View style={styles.emptyRoutes}>
                      <Ionicons name="calendar-outline" size={48} color={Colors.muted} />
                      <Text style={styles.emptyRoutesText}>{t("profile.noEventsCreated")}</Text>
                      <Text style={styles.emptyRoutesSub}>{t("profile.createFirstEvent")}</Text>
                    </View>
                  ) : (
                    <View style={styles.myRoutesList}>
                      {myEvents.map((event) => {
                        const eventDate = new Date(event.start_time);
                        const dateStr = eventDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        
                        return (
                          <Pressable 
                            key={event.id} 
                            onPress={() => router.push(`/event/${event.id}`)}
                            style={styles.myEventCard}
                          >
                            <View style={styles.eventIconBox}>
                              <Ionicons name="calendar" size={24} color={Colors.accent} />
                            </View>
                            <View style={styles.myRouteContent}>
                              <Text style={styles.myRouteTitle} numberOfLines={1}>{event.title}</Text>
                              <Text style={styles.myEventLocation} numberOfLines={1}>
                                <Ionicons name="location" size={12} color={Colors.muted} /> {event.location_name || "Location TBD"}
                              </Text>
                              <View style={styles.myRouteStats}>
                                <Text style={styles.myRouteStat}>
                                  <Ionicons name="time-outline" size={12} color={Colors.accent} /> {dateStr}
                                </Text>
                                <Text style={styles.myRouteStat}>
                                  <Ionicons name="people-outline" size={12} color={Colors.accent} /> {event.participants_count}
                                </Text>
                              </View>
                              
                              <Pressable 
                                onPress={() => router.push(`/event/${event.id}`)} 
                                style={styles.editRouteBtn}
                              >
                                <Ionicons name="create-outline" size={16} color={Colors.accent} />
                                <Text style={styles.editRouteBtnText}>Edit</Text>
                              </Pressable>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.profileSettings")}</Text>
          <Row
            title={t("profile.editProfile")}
            subtitle={t("profile.bioMotorcycleCountry")}
            leftIcon="person-outline"
            onPress={() => router.push("/profile/edit")}
          />
          <Row
            title={t("profile.friends")}
            subtitle={`${friends.length} ${t("profile.friendsAddOrMessage")}`}
            leftIcon="people-outline"
            onPress={() => router.push("/profile/friends")}
          />
          <Row
            title={t("profile.privacySettings")}
            subtitle={t("profile.privacySubtitle")}
            leftIcon="shield-outline"
            onPress={() => router.push("/profile/edit")}
          />
          <Row
            title={t("settings.language")}
            subtitle={i18n.language === "ro" ? t("settings.romanian") : t("settings.english")}
            leftIcon="language-outline"
            right={
              <View style={styles.langSwitcher}>
                <Pressable
                  onPress={() => i18n.changeLanguage("en")}
                  style={[styles.langBtn, i18n.language === "en" && styles.langBtnActive]}
                >
                  <Text style={[styles.langBtnText, i18n.language === "en" && styles.langBtnTextActive]}>EN</Text>
                </Pressable>
                <Pressable
                  onPress={() => i18n.changeLanguage("ro")}
                  style={[styles.langBtn, i18n.language === "ro" && styles.langBtnActive]}
                >
                  <Text style={[styles.langBtnText, i18n.language === "ro" && styles.langBtnTextActive]}>RO</Text>
                </Pressable>
              </View>
            }
          />
          <Row
            title={t("profile.notifications")}
            subtitle={t("profile.notificationsSubtitle")}
            leftIcon="notifications-outline"
            onPress={() => {}}
            right={<Text style={styles.lockedText}>{t("common.comingSoon")}</Text>}
          />
        </View>

        {/* APP & LEGAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.appAndLegal")}</Text>
          <Row title={t("profile.terms")} leftIcon="document-text-outline" onPress={() => router.push("/profile/legal/terms")} />
          <Row title={t("profile.privacyPolicy")} leftIcon="lock-closed-outline" onPress={() => router.push("/profile/legal/privacy")} />
          <Row title={t("profile.aboutMotoGO")} leftIcon="information-circle-outline" onPress={() => router.push("/profile/legal/about")} />
          <Row title={t("profile.credits")} leftIcon="people-outline" onPress={() => router.push("/profile/legal/credits")} />
        </View>

        {/* SUPPORT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.support")}</Text>
          <Row title={t("profile.helpCenter")} leftIcon="help-circle-outline" onPress={() => {}} right={<Text style={styles.lockedText}>{t("common.comingSoon")}</Text>} />
          <Row title={t("profile.contactSupport")} leftIcon="mail-outline" onPress={() => {}} right={<Text style={styles.lockedText}>{t("common.comingSoon")}</Text>} />
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.account")}</Text>
          <Row
            title={t("profile.logout")}
            leftIcon="log-out-outline"
            onPress={async () => {
              try {
                await logout();
              } catch {}
            }}
          />
        </View>

      </ScrollView>

      {/* LICENSE UPLOAD MODAL */}
      <Modal
        visible={showLicenseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLicenseModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>License Verification</Text>
            <Pressable onPress={() => setShowLicenseModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Info Card */}
            <View style={styles.licenseInfoCard}>
              <Ionicons name="information-circle" size={24} color={Colors.accent} />
              <Text style={styles.licenseInfoText}>
                To participate in rankings and track kilometers, you need to verify your motorcycle license (A1, A2, or A).
              </Text>
            </View>

            {/* Current Status */}
            {licenseStatus?.license_type && (
              <View style={[
                styles.currentStatusCard,
                licenseStatus.license_verified && styles.currentStatusVerified,
              ]}>
                <Ionicons 
                  name={licenseStatus.license_verified ? "checkmark-circle" : "time"} 
                  size={24} 
                  color={licenseStatus.license_verified ? Colors.success : Colors.warning} 
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentStatusTitle}>
                    {licenseStatus.license_verified ? "License Verified!" : "Verification Pending"}
                  </Text>
                  <Text style={styles.currentStatusSub}>
                    License Type: {licenseStatus.license_type}
                  </Text>
                </View>
              </View>
            )}

            {/* License Type Selection */}
            {!licenseStatus?.license_verified && (
              <>
                <Text style={styles.modalSectionTitle}>Select License Type</Text>
                <View style={styles.licenseTypeGrid}>
                  {["A1", "A2", "A"].map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setSelectedLicenseType(type)}
                      style={[
                        styles.licenseTypeBtn,
                        selectedLicenseType === type && styles.licenseTypeBtnActive,
                      ]}
                    >
                      <Ionicons 
                        name="card" 
                        size={20} 
                        color={selectedLicenseType === type ? Colors.bg : Colors.text} 
                      />
                      <Text style={[
                        styles.licenseTypeBtnText,
                        selectedLicenseType === type && styles.licenseTypeBtnTextActive,
                      ]}>
                        {type}
                      </Text>
                      <Text style={[
                        styles.licenseTypeBtnSub,
                        selectedLicenseType === type && styles.licenseTypeBtnSubActive,
                      ]}>
                        {type === "A1" ? "≤125cc" : type === "A2" ? "≤35kW" : "Unlimited"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Photo Upload */}
                <Text style={styles.modalSectionTitle}>Upload License Photo</Text>
                <Pressable onPress={pickLicensePhoto} style={styles.photoUploadArea}>
                  {licensePhoto ? (
                    <Image source={{ uri: licensePhoto }} style={styles.licensePhotoPreview} />
                  ) : (
                    <>
                      <Ionicons name="camera" size={48} color={Colors.muted} />
                      <Text style={styles.photoUploadText}>Tap to select photo</Text>
                      <Text style={styles.photoUploadSub}>Make sure all details are visible</Text>
                    </>
                  )}
                </Pressable>

                {/* Submit Button */}
                <Pressable
                  onPress={submitLicense}
                  disabled={!licensePhoto || uploadingLicense}
                  style={[
                    styles.submitLicenseBtn,
                    (!licensePhoto || uploadingLicense) && styles.submitLicenseBtnDisabled,
                  ]}
                >
                  {uploadingLicense ? (
                    <ActivityIndicator color={Colors.bg} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={licensePhoto ? Colors.bg : Colors.muted} />
                      <Text style={[
                        styles.submitLicenseBtnText,
                        !licensePhoto && styles.submitLicenseBtnTextDisabled,
                      ]}>
                        Submit for Verification
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 28 },
  header: { paddingTop: 12, paddingBottom: 8, gap: 4 },
  h1: { color: Colors.text, fontSize: 22, fontFamily: "Inter_900Black" },
  sub: { color: Colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  profileCard: {
    marginTop: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: {
    color: Colors.bg,
    fontSize: 11,
    fontFamily: "Inter_900Black",
  },
  username: { color: Colors.text, fontSize: 16, fontFamily: "Inter_900Black" },
  levelTitle: { color: Colors.accent, fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 2 },
  meta: { marginTop: 4, color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },

  levelCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  levelCardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  levelCardSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.card2,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },

  friendsCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  friendsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsCount: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  friendsLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  friendsPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    borderWidth: 2,
    borderColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  friendMiniImage: {
    width: "100%",
    height: "100%",
  },
  friendMoreBadge: {
    backgroundColor: Colors.accent,
  },
  friendMoreText: {
    color: Colors.bg,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },

  section: { marginTop: 18, gap: 10 },
  sectionTitle: { color: Colors.text, fontSize: 13, fontFamily: "Inter_900Black" },

  // Rankings Section
  rankingsSection: {
    marginTop: 12,
  },
  rankingCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankingIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankingInfo: {
    flex: 1,
  },
  rankingTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  rankingSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },

  // My Content Expandable Header
  myContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  myContentHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  myContentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  myContentTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  myContentSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },

  center: { paddingVertical: 12, alignItems: "center" },
  errorText: { color: Colors.danger, fontSize: 12, fontFamily: "Inter_700Bold" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  statValue: { color: Colors.text, fontSize: 18, fontFamily: "Inter_900Black" },
  statLabel: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsNote: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },

  premiumHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  premiumGoCard: {
    marginTop: 16,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: `${Colors.accent}44`,
    borderRadius: 18,
    padding: 16,
  },
  premiumGoGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: `${Colors.accent}10`,
  },
  premiumGoIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1,
    borderColor: `${Colors.accent}35`,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumGoInfo: { flex: 1, gap: 2 },
  premiumGoTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  premiumGoSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  premiumGoPriceBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  premiumGoPrice: {
    color: Colors.accent,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  premiumGoPricePer: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  row: {
    minHeight: 52,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    height: 36,
    width: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_900Black" },
  rowSubtitle: { marginTop: 2, color: Colors.muted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lockedText: { color: Colors.muted, fontSize: 12, fontFamily: "Inter_700Bold" },

  // Language switcher
  langSwitcher: {
    flexDirection: "row",
    gap: 4,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  langBtnText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  langBtnTextActive: {
    color: Colors.bg,
  },

  // Tab Switcher Styles
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.bg,
  },
  tabBtnText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tabBtnTextActive: {
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  createContentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  createContentBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  myEventCard: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  eventIconBox: {
    width: 70,
    backgroundColor: Colors.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  myEventLocation: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  editRouteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.card2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editRouteBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // My Routes Styles
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addRouteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  addRouteBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  emptyRoutes: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    gap: 10,
  },
  emptyRoutesText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  emptyRoutesSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  myRoutesList: {
    gap: 12,
  },
  myRouteCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  myRouteContent: {
    padding: 14,
    gap: 8,
  },
  myRouteTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  myRouteStats: {
    flexDirection: "row",
    gap: 16,
  },
  myRouteStat: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  myRouteDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  myRouteDate: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  myRouteActions: {
    marginTop: 4,
  },
  startRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startRideBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  endRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.danger,
    paddingVertical: 12,
    borderRadius: 12,
  },
  endRideBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  rideLocked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card2,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rideLockedText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // License verification styles
  licenseCard: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  licenseIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  licenseInfo: {
    flex: 1,
  },
  licenseTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  licenseSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  licenseStatus: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  licenseStatusVerified: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  licenseStatusPending: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  licenseStatusText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  licenseStatusTextVerified: {
    color: Colors.bg,
  },

  // Modal styles
  modalSafe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 16,
    gap: 20,
  },
  modalSectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  licenseInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  licenseInfoText: {
    color: Colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    lineHeight: 20,
  },
  currentStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 16,
    padding: 16,
  },
  currentStatusVerified: {
    borderColor: Colors.success,
  },
  currentStatusTitle: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  currentStatusSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  licenseTypeGrid: {
    flexDirection: "row",
    gap: 12,
  },
  licenseTypeBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  licenseTypeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  licenseTypeBtnText: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_900Black",
  },
  licenseTypeBtnTextActive: {
    color: Colors.bg,
  },
  licenseTypeBtnSub: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  licenseTypeBtnSubActive: {
    color: "rgba(0,0,0,0.6)",
  },
  photoUploadArea: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 180,
  },
  photoUploadText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  photoUploadSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  licensePhotoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  submitLicenseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  submitLicenseBtnDisabled: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitLicenseBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  submitLicenseBtnTextDisabled: {
    color: Colors.muted,
  },
});

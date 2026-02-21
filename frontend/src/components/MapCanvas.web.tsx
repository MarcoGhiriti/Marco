import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

type MapCanvasProps = {
  mapRef: React.RefObject<any>;
  region: any;
  onRegionChangeComplete: (region: any) => void;
  onPanDrag: () => void;
  onRecenter: () => void;
  onSearchArea: () => void;
  showSearchArea: boolean;
  events: any[];
  gasMarkers: any[];
  policeReports: any[];
  showEvents: boolean;
  showGas: boolean;
  showService: boolean;
  showFriends: boolean;
  friendMarkers: any[];
  onToggleEvents: () => void;
  onToggleGas: () => void;
  onToggleService: () => void;
  onToggleFriends: () => void;
  onReportPolice: () => void;
  onVotePolice: (reportId: string, vote: "up" | "down", lat: number, lng: number) => void;
  isFetching: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onEventPress?: (eventId: string) => void;
};

export default function MapCanvas(_props: MapCanvasProps) {
  return (
    <View style={styles.card}>
      <Ionicons name="map" size={64} color={Colors.accent} />
      <Text style={styles.title}>Interactive Map</Text>
      <Text style={styles.desc}>Live map is available on mobile devices.</Text>
      <Text style={styles.descSub}>
        Only event markers + Report Police are shown. Open Expo Go on your phone to use it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: { color: Colors.text, fontSize: 20, fontFamily: "Inter_900Black" },
  desc: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 20,
  },
  descSub: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
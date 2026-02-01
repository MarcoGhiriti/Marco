import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { apiGet } from "../lib/api";

interface PlaceResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlaceSearchInputProps {
  placeholder: string;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value?: string;
  onPlaceSelected: (place: PlaceDetails) => void;
  headers?: Record<string, string>;
}

export function PlaceSearchInput({
  placeholder,
  label,
  icon = "location-outline",
  iconColor = Colors.accent,
  value,
  onPlaceSelected,
  headers,
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(value || null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
      setSelectedPlace(value);
    }
  }, [value]);

  const searchPlaces = useCallback(async (text: string) => {
    if (text.length < 2 || !headers) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiGet(`/api/places/autocomplete?query=${encodeURIComponent(text)}`, headers);
      setResults(data || []);
      setShowResults(true);
    } catch (error) {
      console.error("Places search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const handleTextChange = (text: string) => {
    setQuery(text);
    setSelectedPlace(null);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 300);
  };

  const handleSelectPlace = async (place: PlaceResult) => {
    setQuery(place.main_text);
    setSelectedPlace(place.description);
    setShowResults(false);
    setResults([]);
    Keyboard.dismiss();

    // Fetch place details
    if (headers) {
      try {
        setLoading(true);
        const details = await apiGet(
          `/api/places/details?place_id=${encodeURIComponent(place.place_id)}`,
          headers
        ) as PlaceDetails;
        onPlaceSelected(details);
      } catch (error) {
        console.error("Place details error:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const clearInput = () => {
    setQuery("");
    setSelectedPlace(null);
    setResults([]);
    setShowResults(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={20} color={iconColor} style={styles.inputIcon} />
        
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
        />
        
        {loading ? (
          <ActivityIndicator size="small" color={Colors.accent} style={styles.rightIcon} />
        ) : query.length > 0 ? (
          <Pressable onPress={clearInput} style={styles.rightIcon}>
            <Ionicons name="close-circle" size={20} color={Colors.muted} />
          </Pressable>
        ) : null}
        
        {selectedPlace && (
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} style={styles.checkIcon} />
        )}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.resultItem}
                onPress={() => handleSelectPlace(item)}
              >
                <Ionicons name="location" size={18} color={Colors.accent} />
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultMainText} numberOfLines={1}>
                    {item.main_text}
                  </Text>
                  {item.secondary_text ? (
                    <Text style={styles.resultSecondaryText} numberOfLines={1}>
                      {item.secondary_text}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    zIndex: 100,
  },
  label: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  rightIcon: {
    padding: 4,
  },
  checkIcon: {
    marginLeft: 8,
  },
  resultsContainer: {
    marginTop: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    maxHeight: 250,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultMainText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  resultSecondaryText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 14,
  },
});

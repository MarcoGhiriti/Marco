import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Colors } from "../../src/theme/colors";
import { apiPost } from "../../src/lib/api";
import { useAuthStore } from "../../src/state/authStore";

export default function CreateStoryScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const pickMedia = async (type: "image" | "video") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permission required to access media library");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        type === "image"
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      base64: type === "image",
      videoMaxDuration: 30,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;

    if (type === "image") {
      // Compress and resize image
      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const b64 = manip.base64
        ? `data:image/jpeg;base64,${manip.base64}`
        : null;
      if (!b64) {
        setError("Failed to process image");
        return;
      }
      setMediaBase64(b64);
      setMediaType("image");
    } else {
      // For video, we'll use the URI directly
      // Note: Base64 for videos is not practical, 
      // in production you'd upload to a storage service
      setMediaBase64(asset.uri);
      setMediaType("video");
    }
    setError(null);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission required");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;

    const manip = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const b64 = manip.base64
      ? `data:image/jpeg;base64,${manip.base64}`
      : null;
    if (!b64) {
      setError("Failed to process image");
      return;
    }
    setMediaBase64(b64);
    setMediaType("image");
    setError(null);
  };

  const publishStory = async () => {
    if (!headers || !mediaBase64) return;

    setLoading(true);
    setError(null);
    try {
      await apiPost(
        "/api/stories",
        {
          media_base64: mediaBase64,
          media_type: mediaType,
          caption: caption.trim() || null,
        },
        headers
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish story");
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
          <Text style={styles.headerTitle}>New Story</Text>
          <Pressable
            onPress={publishStory}
            disabled={!mediaBase64 || loading}
            style={[
              styles.headerBtn,
              styles.publishBtn,
              (!mediaBase64 || loading) && styles.publishBtnDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg} size="small" />
            ) : (
              <Text style={styles.publishText}>Post</Text>
            )}
          </Pressable>
        </View>

        {/* Preview Area */}
        <View style={styles.previewContainer}>
          {mediaBase64 ? (
            <View style={styles.previewWrapper}>
              <Image
                source={{ uri: mediaBase64 }}
                style={styles.previewImage}
                resizeMode="cover"
              />

              {/* Story frame preview overlay */}
              <View pointerEvents="none" style={styles.frameOverlay}>
                <View style={styles.frameBorder} />
                <View style={styles.frameTopFade} />
                <View style={styles.frameBottomFade} />
              </View>

              <Pressable
                onPress={() => setMediaBase64(null)}
                style={styles.removeBtn}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons
                name="image-outline"
                size={64}
                color={Colors.muted}
              />
              <Text style={styles.placeholderText}>
                Select a photo or video
              </Text>
            </View>
          )}
        </View>

        {/* Caption Input */}
        {mediaBase64 && (
          <View style={styles.captionContainer}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor={Colors.muted}
              style={styles.captionInput}
              maxLength={200}
              multiline
            />
          </View>
        )}

        {/* Error */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Media Picker Buttons */}
        {!mediaBase64 && (
          <View style={styles.pickerButtons}>
            <Pressable onPress={takePhoto} style={styles.pickerBtn}>
              <Ionicons name="camera" size={24} color={Colors.accent} />
              <Text style={styles.pickerBtnText}>Camera</Text>
            </Pressable>
            <Pressable onPress={() => pickMedia("image")} style={styles.pickerBtn}>
              <Ionicons name="image" size={24} color={Colors.accent} />
              <Text style={styles.pickerBtnText}>Photo</Text>
            </Pressable>
            <Pressable onPress={() => pickMedia("video")} style={styles.pickerBtn}>
              <Ionicons name="videocam" size={24} color={Colors.accent} />
              <Text style={styles.pickerBtnText}>Video</Text>
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoContainer}>
          <Ionicons name="time-outline" size={16} color={Colors.muted} />
          <Text style={styles.infoText}>
            Stories disappear after 24 hours
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_900Black",
  },
  publishBtn: {
    width: 72,
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishText: {
    color: Colors.bg,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  previewContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  previewWrapper: {
    width: "100%",
    maxHeight: 500,
    aspectRatio: 9 / 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  frameOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
  },
  frameBorder: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 22,
  },
  frameTopFade: {
    height: 90,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  frameBottomFade: {
    height: 110,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 400,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholderText: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  captionInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    maxHeight: 100,
  },
  error: {
    marginHorizontal: 16,
    marginBottom: 12,
    color: Colors.danger,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  pickerButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pickerBtn: {
    flex: 1,
    maxWidth: 110,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  pickerBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 24,
  },
  infoText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

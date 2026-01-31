import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#39FF88",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    } catch (e) {
      console.log("Error getting push token:", e);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

// Badge notification types
type BadgeNotification = {
  badgeType: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
};

export async function showBadgeNotification(badge: BadgeNotification) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🏆 New Badge Earned!",
      body: `${badge.badgeName}: ${badge.badgeDescription}`,
      data: { type: "badge", badgeType: badge.badgeType },
      sound: true,
    },
    trigger: null, // Show immediately
  });
}

export async function showRideCompleteNotification(kmTracked: number, isValidated: boolean) {
  if (isValidated) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏍️ Ride Complete!",
        body: `Great ride! ${kmTracked.toFixed(1)} km has been added to your stats.`,
        data: { type: "ride_complete", km: kmTracked },
        sound: true,
      },
      trigger: null,
    });
  }
}

export async function showFriendRequestNotification(username: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "👋 New Friend Request",
      body: `${username} wants to be your friend!`,
      data: { type: "friend_request", username },
      sound: true,
    },
    trigger: null,
  });
}

export async function showNewMessageNotification(fromUsername: string, preview: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${fromUsername}`,
      body: preview.length > 50 ? preview.substring(0, 50) + "..." : preview,
      data: { type: "message", from: fromUsername },
      sound: true,
    },
    trigger: null,
  });
}

// Hook for listening to notifications
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

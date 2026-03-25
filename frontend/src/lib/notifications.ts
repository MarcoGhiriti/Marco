import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { apiPost } from "./api";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications(accessToken: string | null) {
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const register = async () => {
      if (Platform.OS === "web") return;
      if (!Device.isDevice) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#36F19A",
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        await apiPost("/api/push/register", {
          token: tokenData.data,
          platform: Platform.OS,
        }, { Authorization: `Bearer ${accessToken}` });
      } catch (e) {
        console.log("Push token registration skipped:", e);
      }
    };

    register();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [accessToken]);
}

export async function scheduleLocalBikeAlerts(bikeData: {
  insurance_expiry?: string | null;
  itp_expiry?: string | null;
  next_service_km?: number | null;
  current_km?: number | null;
}) {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith("bike-")) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const now = new Date();

  if (bikeData.insurance_expiry) {
    const expiry = new Date(bikeData.insurance_expiry);
    const rem = new Date(expiry.getTime() - 7 * 86400000);
    if (rem > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: "bike-insurance",
        content: { title: "Insurance Expiring Soon", body: `Expires ${expiry.toLocaleDateString()}. Renew now!`, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: rem },
      });
    }
  }

  if (bikeData.itp_expiry) {
    const expiry = new Date(bikeData.itp_expiry);
    const rem = new Date(expiry.getTime() - 7 * 86400000);
    if (rem > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: "bike-itp",
        content: { title: "ITP Inspection Expiring", body: `Expires ${expiry.toLocaleDateString()}. Schedule now!`, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: rem },
      });
    }
  }

  if (bikeData.next_service_km && bikeData.current_km) {
    const kmLeft = bikeData.next_service_km - bikeData.current_km;
    if (kmLeft <= 500 && kmLeft > 0) {
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
      await Notifications.scheduleNotificationAsync({
        identifier: "bike-service",
        content: { title: "Service Due Soon", body: `${kmLeft} km until next service.`, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow },
      });
    }
  }
}

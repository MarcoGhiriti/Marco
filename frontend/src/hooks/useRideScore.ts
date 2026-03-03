import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const CACHE_KEY = "ride_score_cache_v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const LOCATION_THRESHOLD_KM = 2;

export type WeatherCondition = "sun" | "cloud" | "rain" | "wind" | "snow" | "storm";
export type RideLabel = "GREAT" | "GOOD" | "CAUTION" | "NO";

export type RideScoreData = {
  score: number;
  label: RideLabel;
  condition: WeatherCondition;
  temp: number;
  windKmh: number;
  rainProb: number;
  summary: string;
  fetchedAt: number;
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function codeToCondition(code: number, windKmh: number): WeatherCondition {
  if (code >= 95) return "storm";
  if (code >= 71 && code <= 77) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return "rain";
  if (windKmh > 30) return "wind";
  if (code >= 3 || code === 45 || code === 48) return "cloud";
  return "sun";
}

function computeScore(temp: number, windKmh: number, rainProb: number): number {
  let score = 10;
  if (rainProb > 70) score -= 7;
  else if (rainProb > 40) score -= 4;
  else if (rainProb > 20) score -= 2;
  if (windKmh > 45) score -= 4;
  else if (windKmh > 30) score -= 2;
  else if (windKmh > 20) score -= 1;
  if (temp < 5) score -= 2;
  else if (temp < 10) score -= 1;
  if (temp > 32) score -= 2;
  else if (temp > 28) score -= 1;
  return Math.max(0, Math.min(10, score));
}

function toLabel(score: number): RideLabel {
  if (score >= 8.5) return "GREAT";
  if (score >= 7) return "GOOD";
  if (score >= 4) return "CAUTION";
  return "NO";
}

function buildSummary(label: RideLabel, cond: WeatherCondition, windKmh: number, rainProb: number): string {
  if (label === "GREAT") return "Great conditions for a ride!";
  if (label === "GOOD") return "Good conditions, enjoy the road!";
  if (cond === "storm") return "Not recommended: thunderstorm active";
  if (cond === "rain" || rainProb > 40) return `Rain likely (${rainProb}%) — ride with care`;
  if (windKmh > 30) return `Strong wind (${windKmh} km/h) — ride with caution`;
  if (label === "NO") return "Not recommended: poor conditions";
  return "Mixed conditions — ride carefully";
}

type CacheEntry = { data: RideScoreData; lat: number; lng: number; fetchedAt: number };

export function useRideScore(params: {
  lat: number | null;
  lng: number | null;
  hasPermission: boolean;
}) {
  const { lat, lng, hasPermission } = params;
  const [data, setData] = useState<RideScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const lastRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScore = useCallback(
    async (fLat: number, fLng: number, force = false) => {
      if (!hasPermission) return;
      const now = Date.now();
      const last = lastRef.current;
      if (!force && last) {
        const tooSoon = now - last.time < CACHE_TTL_MS;
        const tooClose = haversine(last.lat, last.lng, fLat, fLng) < LOCATION_THRESHOLD_KM;
        if (tooSoon && tooClose) return;
      }

      setLoading(true);
      setIsOffline(false);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${fLat}&longitude=${fLng}` +
          `&current=temperature_2m,wind_speed_10m,weather_code` +
          `&hourly=precipitation_probability` +
          `&forecast_days=1&wind_speed_unit=kmh&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch_error");
        const json = await res.json();

        const temp: number = json.current?.temperature_2m ?? 20;
        const windKmh: number = json.current?.wind_speed_10m ?? 0;
        const weatherCode: number = json.current?.weather_code ?? 0;
        const hour = new Date().getHours();
        const rainProb: number = json.hourly?.precipitation_probability?.[hour] ?? 0;

        const score = Math.round(computeScore(temp, windKmh, rainProb) * 10) / 10;
        const label = toLabel(score);
        const condition = codeToCondition(weatherCode, windKmh);

        const entry: RideScoreData = {
          score,
          label,
          condition,
          temp: Math.round(temp),
          windKmh: Math.round(windKmh),
          rainProb: Math.round(rainProb),
          summary: buildSummary(label, condition, Math.round(windKmh), Math.round(rainProb)),
          fetchedAt: now,
        };

        setData(entry);
        lastRef.current = { lat: fLat, lng: fLng, time: now };
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: entry, lat: fLat, lng: fLng, fetchedAt: now } as CacheEntry)
        );
      } catch (_) {
        setIsOffline(true);
        // Try stale cache
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const entry: CacheEntry = JSON.parse(raw);
            setData(entry.data);
          }
        } catch (_2) {}
      } finally {
        setLoading(false);
      }
    },
    [hasPermission]
  );

  // Load stale cache on mount for instant display
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          const age = Date.now() - entry.fetchedAt;
          if (age < CACHE_TTL_MS * 3) {
            setData(entry.data);
            lastRef.current = { lat: entry.lat, lng: entry.lng, time: entry.fetchedAt };
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch when location becomes available
  useEffect(() => {
    if (lat !== null && lng !== null && hasPermission) {
      fetchScore(lat, lng);
    }
  }, [lat, lng, hasPermission, fetchScore]);

  // Periodic refresh timer
  useEffect(() => {
    if (!hasPermission || lat === null || lng === null) return;
    timerRef.current = setInterval(() => {
      fetchScore(lat, lng, true);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasPermission, lat, lng, fetchScore]);

  return { data, loading, isOffline };
}

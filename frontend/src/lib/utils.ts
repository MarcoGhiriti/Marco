/**
 * Format duration: if >= 60 min, show as "Xh Ymin", else "X min"
 */
export function formatDuration(minutes: number | undefined | null): string {
  if (!minutes || minutes <= 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Open Google Maps with directions from start to end of a polyline
 */
export function openDirectionsInGoogleMaps(polyline: number[][] | undefined) {
  if (!polyline || polyline.length < 2) return;
  const start = polyline[0];
  const end = polyline[polyline.length - 1];
  const url = `https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${end[0]},${end[1]}&travelmode=driving`;
  // Use Linking for React Native, window.open for web
  try {
    const { Linking } = require("react-native");
    Linking.openURL(url);
  } catch {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }
}

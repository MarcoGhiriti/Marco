import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { API_BASE_URL, apiPost } from "./api";

WebBrowser.maybeCompleteAuthSession();
export const GOOGLE_AUTH_CALLBACK_PATH = "/auth/google-callback";

type GoogleAuthExchange = {
  access_token: string;
};

const extractAccessToken = (url: string): string | null => {
  const parsed = Linking.parse(url);
  const parsedAccessToken = parsed.queryParams?.access_token;
  if (typeof parsedAccessToken === "string" && parsedAccessToken.trim()) {
    return parsedAccessToken.trim();
  }

  const fragment = url.split("#")[1] ?? "";
  const params = new URLSearchParams(fragment);
  return params.get("access_token")?.trim() || null;
};

export const extractSessionId = (url: string): string | null => {
  const parsed = Linking.parse(url);
  const parsedSessionId = parsed.queryParams?.session_id;
  if (typeof parsedSessionId === "string" && parsedSessionId.trim()) {
    return parsedSessionId.trim();
  }

  const fragment = url.split("#")[1] ?? "";
  const params = new URLSearchParams(fragment);
  const rawSessionId = params.get("session_id");
  return rawSessionId?.trim() || null;
};

export async function exchangeGoogleSession(sessionId: string): Promise<string> {
  const data = await apiPost<GoogleAuthExchange>("/api/auth/google", {
    session_id: sessionId,
  });

  if (!data.access_token) {
    throw new Error("Google login failed");
  }

  return data.access_token;
}

export async function completeGoogleAuthFromUrl(url: string): Promise<string> {
  const accessToken = extractAccessToken(url);
  if (accessToken) {
    return accessToken;
  }

  const sessionId = extractSessionId(url);
  if (!sessionId) {
    throw new Error("Google session was not returned");
  }

  return exchangeGoogleSession(sessionId);
}

export async function startGoogleAuth(): Promise<string | null> {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = Linking.createURL(GOOGLE_AUTH_CALLBACK_PATH);
  const authUrl = `${API_BASE_URL}/api/auth/google/start?redirect_uri=${encodeURIComponent(redirectUrl)}`;

  try {
    // Dismiss any lingering browser sessions first
    try { await WebBrowser.dismissBrowser(); } catch (_) {}
    await WebBrowser.warmUpAsync();
  } catch (_) {
    // warmUp not available on all devices, ignore
  }

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
    });
  } catch (browserError) {
    // Fallback: some Android devices fail with openAuthSessionAsync
    // Try opening in external browser as last resort
    console.warn("WebBrowser.openAuthSessionAsync failed, trying Linking.openURL:", browserError);
    await Linking.openURL(authUrl);
    // User will need to come back via deep link - return null (not an error)
    return null;
  } finally {
    try { await WebBrowser.coolDownAsync(); } catch (_) {}
  }

  if (result.type === "success" && result.url) {
    return completeGoogleAuthFromUrl(result.url);
  }
  if (result.type === "cancel") {
    throw new Error("Google login was cancelled");
  }
  return null;
}
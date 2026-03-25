import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { apiPost } from "./api";

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthExchange = {
  access_token: string;
};

const extractSessionId = (url: string): string | null => {
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

export async function startGoogleAuth(redirectPath: string): Promise<string> {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = Linking.createURL(redirectPath);
  const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type !== "success" || !result.url) {
    throw new Error("Google login was cancelled");
  }

  const sessionId = extractSessionId(result.url);
  if (!sessionId) {
    throw new Error("Google session was not returned");
  }

  const data = await apiPost<GoogleAuthExchange>("/api/auth/google", {
    session_id: sessionId,
  });

  if (!data.access_token) {
    throw new Error("Google login failed");
  }

  return data.access_token;
}
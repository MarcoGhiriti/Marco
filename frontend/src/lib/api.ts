import Constants from "expo-constants";

function getBackendBaseUrl(): string {
  // Prefer process.env in dev, fallback to expo config extras.
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && typeof envUrl === "string") return envUrl;

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraUrl = extra?.EXPO_PUBLIC_BACKEND_URL;
  if (typeof extraUrl === "string") return extraUrl;

  throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured");
}

export const API_BASE_URL = getBackendBaseUrl();

export async function apiGet<T>(
  path: string,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiDelete<T>(
  path: string,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

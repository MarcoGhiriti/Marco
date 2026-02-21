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
    let errorMessage = `GET ${path} failed: ${res.status} ${text}`;
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        errorMessage = json.detail;
      }
    } catch {
      // Not JSON or no detail field - use generic error
    }
    throw new Error(errorMessage);
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
    // Try to extract detail message from JSON error response
    let errorMessage = `POST ${path} failed: ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        // Handle Pydantic validation errors (detail is array of objects)
        if (Array.isArray(json.detail)) {
          const messages = json.detail.map((err: any) => {
            const field = err.loc?.[err.loc.length - 1] || "field";
            const msg = err.msg || "";
            
            // Translate common validation errors to Romanian
            if (msg.includes("at least 8 characters")) {
              return field === "password" 
                ? "Parola trebuie să aibă minim 8 caractere"
                : `${field} trebuie să aibă minim 8 caractere`;
            }
            if (msg.includes("at least 3 characters")) {
              return field === "username"
                ? "Username-ul trebuie să aibă minim 3 caractere"
                : `${field} trebuie să aibă minim 3 caractere`;
            }
            if (msg.includes("valid email")) {
              return "Adresa de email nu este validă";
            }
            if (msg.includes("already") || msg.includes("exists")) {
              return field === "email" 
                ? "Acest email este deja folosit"
                : field === "username"
                ? "Acest username este deja folosit"
                : msg;
            }
            return msg || `${field} invalid`;
          });
          errorMessage = messages.join(". ");
        } else {
          // Single string detail
          errorMessage = json.detail;
        }
      }
    } catch {
      // Not JSON or no detail field - use generic error
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
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

export async function apiPut<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let errorMessage = `PUT ${path} failed: ${res.status} ${text}`;
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        errorMessage = json.detail;
      }
    } catch {
      // Not JSON or no detail field - use generic error
    }
    throw new Error(errorMessage);
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

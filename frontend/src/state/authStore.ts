
import { create } from "zustand";
import { clearToken, getToken, setToken } from "../lib/auth";
import { apiGet, apiPost } from "../lib/api";

export type Me = {
  id: string;
  email: string;
  username: string;
  profile_photo_base64?: string | null;
  bio: string;
  bike?: { model?: string | null; cc?: number | null } | null;
  country?: string | null;
  km_total: number;
  km_month: number;
  level: number;
};

type AuthState = {
  accessToken: string | null;
  me: Me | null;
  initializing: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  me: null,
  initializing: true,
  error: null,

  bootstrap: async () => {
    try {
      const token = await getToken();
      set({ accessToken: token, initializing: false });
      if (token) {
        await get().refreshMe();
      }
    } catch (e) {
      set({ initializing: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  },

  refreshMe: async () => {
    const token = get().accessToken;
    if (!token) return;

    const me = await apiGet<Me>("/api/me", {
      Authorization: `Bearer ${token}`,
    });
    set({ me });
  },

  login: async (email, password) => {
    set({ error: null });
    const resp = await apiPost<{ access_token: string }>("/api/auth/login", { email, password });
    await setToken(resp.access_token);
    set({ accessToken: resp.access_token });
    await get().refreshMe();
  },

  register: async (email, username, password) => {
    set({ error: null });
    const resp = await apiPost<{ access_token: string }>("/api/auth/register", {
      email,
      username,
      password,
    });
    await setToken(resp.access_token);
    set({ accessToken: resp.access_token });
    await get().refreshMe();
  },

  loginWithToken: async (token: string) => {
    await setToken(token);
    set({ accessToken: token });
    await get().refreshMe();
  },

  logout: async () => {
    await clearToken();
    set({ accessToken: null, me: null });
  },
}));

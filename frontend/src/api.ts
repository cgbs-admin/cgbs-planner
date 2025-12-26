// src/api.ts

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8001" : "/api");


let authToken: string | null = null;

export const AUTH_LOGOUT_EVENT = "auth:logout";

export function loadAuthTokenFromStorage() {
  try {
    const stored = window.localStorage.getItem("authToken");
    authToken = stored;
  } catch {
    authToken = null;
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;

  // IMPORTANT:
  // Do NOT dispatch AUTH_LOGOUT_EVENT from here.
  // AUTH_LOGOUT_EVENT is reserved for 401/Unauthorized flows inside apiFetch.
  // Dispatching from setAuthToken (especially on manual logout) can create infinite recursion.
  try {
    if (token) {
      window.localStorage.setItem("authToken", token);
    } else {
      window.localStorage.removeItem("authToken");
    }
  } catch {
    // ignore storage errors
  }
}

export function getAuthToken() {
  return authToken;
}

/**
 * Wrapper around fetch that automatically:
 * - prefixes API_BASE_URL if you pass a relative path ("/events")
 * - adds Authorization: Bearer <token> if a token is set
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const isAbsolute = input.startsWith("http://") || input.startsWith("https://");
  const url = isAbsolute ? input : `${API_BASE_URL}${input}`;

  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    // Token is invalid/expired. Clear it so the UI can redirect to Login.
    setAuthToken(null);
    try {
      window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason: "unauthorized" } }));
    } catch {
      // ignore
    }
  }

  return response;
}

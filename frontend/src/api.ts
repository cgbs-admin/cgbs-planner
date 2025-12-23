// src/api.ts

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : "/api");


let authToken: string | null = null;

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

  return fetch(url, { ...init, headers });
}

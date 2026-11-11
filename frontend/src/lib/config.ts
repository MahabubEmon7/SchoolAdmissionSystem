declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl?: string };
  }
}

/** API base URL: runtime config (Docker) → build-time VITE_API_URL → local default. */
export const API_URL = (
  window.__APP_CONFIG__?.apiUrl ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080'
).replace(/\/+$/, '');

export const CLASSES_POLL_MS = 3000;
export const HOLDS_POLL_MS = 3000;

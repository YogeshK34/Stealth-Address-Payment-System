import axios from 'axios';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '/api/v1';

function getPersistedToken(): string | null {
  if (typeof window === 'undefined') return null;

  const legacyToken = localStorage.getItem('stealth_token');
  if (legacyToken) return legacyToken;

  const persisted = localStorage.getItem('stealth-auth');
  if (!persisted) return null;

  try {
    const parsed = JSON.parse(persisted) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = getPersistedToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('stealth_token');
      localStorage.removeItem('stealth-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

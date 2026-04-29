import axios from 'axios';

// API Base URL - Change this to match your backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isMutatingMethod = (method?: string) => {
  const normalized = (method || '').toLowerCase();
  return normalized === 'post' || normalized === 'put' || normalized === 'patch' || normalized === 'delete';
};

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const headers = config.headers || {};

  const token = localStorage.getItem('auth_token');
  if (token) {
    if (typeof (headers as any).set === 'function') {
      (headers as any).set('Authorization', `Bearer ${token}`);
    } else {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  }

  if (isMutatingMethod(config.method)) {
    const currentKey =
      typeof (headers as any).get === 'function'
        ? (headers as any).get('X-Idempotency-Key')
        : (headers as Record<string, string>)['X-Idempotency-Key'];

    if (!currentKey) {
      const generatedKey = createIdempotencyKey();
      if (typeof (headers as any).set === 'function') {
        (headers as any).set('X-Idempotency-Key', generatedKey);
      } else {
        (headers as Record<string, string>)['X-Idempotency-Key'] = generatedKey;
      }
    }
  }

  config.headers = headers;
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error?.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401) {
      // Keep login failures on the same page so inline error messages remain visible.
      if (isLoginRequest) {
        return Promise.reject(error);
      }

      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

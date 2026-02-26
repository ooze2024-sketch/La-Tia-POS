// API Service for LaT ia POS
// Handles all HTTP communication with Laravel backend

// use relative path so Vite proxy can handle cross‑origin during development
const API_BASE_URL = '/api/v1';

// Get token from localStorage
const getToken = () => localStorage.getItem('auth_token');

// Make API request
const apiRequest = async (
  endpoint: string,
  method: string = 'GET',
  body?: any,
  requiresAuth: boolean = true
) => {
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: any = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
      throw new Error('Unauthorized - logging out');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

export const authAPI = {
  login: (username: string, password_hash: string) =>
    apiRequest('/auth/login', 'POST', { username, password_hash }, false),

  getMe: () => apiRequest('/auth/me', 'GET'),

  logout: () => apiRequest('/auth/logout', 'POST'),
};

// ============================================================================
// PRODUCT ENDPOINTS
// ============================================================================

export const productAPI = {
  getAll: () => apiRequest('/products'),

  getById: (id: number) => apiRequest(`/products/${id}`),

  create: (data: any) => apiRequest('/products', 'POST', data),

  update: (id: number, data: any) => apiRequest(`/products/${id}`, 'PUT', data),

  delete: (id: number) => apiRequest(`/products/${id}`, 'DELETE'),

  getByCategory: (categoryId: number) =>
    apiRequest(`/products/category/${categoryId}`),
};

// ============================================================================
// CATEGORY ENDPOINTS
// ============================================================================

export const categoryAPI = {
  getAll: () => apiRequest('/categories'),

  getById: (id: number) => apiRequest(`/categories/${id}`),

  create: (data: any) => apiRequest('/categories', 'POST', data),

  update: (id: number, data: any) => apiRequest(`/categories/${id}`, 'PUT', data),

  delete: (id: number) => apiRequest(`/categories/${id}`, 'DELETE'),
};

// ============================================================================
// INVENTORY ENDPOINTS
// ============================================================================

export const inventoryAPI = {
  getAll: () => apiRequest('/inventory'),

  getById: (id: number) => apiRequest(`/inventory/${id}`),

  create: (data: any) => apiRequest('/inventory', 'POST', data),

  update: (id: number, data: any) => apiRequest(`/inventory/${id}`, 'PUT', data),

  delete: (id: number) => apiRequest(`/inventory/${id}`, 'DELETE'),

  getLowStock: () => apiRequest('/inventory/low-stock'),

  getOutOfStock: () => apiRequest('/inventory/out-of-stock'),
};

// ============================================================================
// SALES ENDPOINTS
// ============================================================================

export const salesAPI = {
  getAll: () => apiRequest('/sales'),

  getById: (id: number) => apiRequest(`/sales/${id}`),

  create: (data: any) => apiRequest('/sales', 'POST', data),

  getToday: () => apiRequest('/sales/today'),

  getMonthlyReport: () => apiRequest('/sales/monthly-report'),

  getPaymentBreakdown: (date?: string) => {
    const endpoint = date
      ? `/sales/payment-breakdown/${date}`
      : '/sales/payment-breakdown';
    return apiRequest(endpoint);
  },

  getBestSelling: (limit: number = 10) =>
    apiRequest(`/sales/best-selling/${limit}`),
};

// ============================================================================
// USER ENDPOINTS
// ============================================================================

export const userAPI = {
  getAll: () => apiRequest('/users'),

  getById: (id: number) => apiRequest(`/users/${id}`),

  create: (data: any) => apiRequest('/users', 'POST', data),

  update: (id: number, data: any) => apiRequest(`/users/${id}`, 'PUT', data),

  delete: (id: number) => apiRequest(`/users/${id}`, 'DELETE'),
};

// ============================================================================
// HELPERS
// ============================================================================

export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('auth_token');
};

export default {
  authAPI,
  productAPI,
  categoryAPI,
  inventoryAPI,
  salesAPI,
  userAPI,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
};

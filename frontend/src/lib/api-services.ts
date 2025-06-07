import { api } from '@/lib/api';
import type {
  AuthResponse,
  User,
  ManufacturingOrder,
  OrdersResponse,
  WorkCentre,
  WorkCentresResponse,
  PlanningBoardResponse,
  DashboardMetrics,
} from '@/types/manufacturing';
import type {
  ApiKey,
  ApiKeyCreate,
  ApiKeyUpdate,
  ApiKeyUsage,
  ApiKeysResponse,
  ApiKeyResponse,
  ApiKeyCreateResponse,
  ApiKeyRotateResponse,
  ApiKeyUsageResponse,
} from '@/types/api-keys';

// Authentication services
export const authService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', {
      username,
      password,
    });
    
    // Store token after successful login
    if (response.access_token) {
      api.setToken(response.access_token);
    }
    
    return response;
  },

  register: async (userData: {
    username: string;
    email: string;
    password: string;
    role: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{ message: string; user: User }> => {
    return api.post('/auth/register', userData);
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/logout');
    api.setToken(null);
    return response;
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    return api.get('/auth/me');
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    
    if (response.access_token) {
      api.setToken(response.access_token);
    }
    
    return response;
  },

  updateProfile: async (userData: Partial<User>): Promise<{ message: string; user: User }> => {
    return api.put('/auth/profile', userData);
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    return api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },
};

// Orders services
export const ordersService = {
  getAll: async (filters?: {
    status?: string;
    priority?: string;
    work_centre_id?: number;
    search?: string;
  }): Promise<OrdersResponse> => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const endpoint = queryParams.toString() ? `/orders?${queryParams}` : '/orders';
    return api.get<OrdersResponse>(endpoint);
  },

  getById: async (id: number): Promise<{ order: ManufacturingOrder }> => {
    return api.get(`/orders/${id}`);
  },

  create: async (orderData: {
    order_number: string;
    stock_code: string;
    description: string;
    quantity_to_make: number;
    current_work_centre_id?: number;
    status?: string;
    priority?: string;
    due_date?: string;
    start_date?: string;
    manufacturing_steps?: Array<{
      step_number: number;
      operation_name: string;
      work_centre_id: number;
      planned_duration_minutes?: number;
    }>;
  }): Promise<{ message: string; order: ManufacturingOrder }> => {
    return api.post('/orders', orderData);
  },

  update: async (id: number, updates: Partial<ManufacturingOrder>): Promise<{ message: string; order: ManufacturingOrder }> => {
    return api.put(`/orders/${id}`, updates);
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/orders/${id}`);
  },

  move: async (id: number, toWorkCentreId: number, reason?: string, newPosition?: number): Promise<{ message: string; order: ManufacturingOrder }> => {
    return api.put(`/orders/${id}/move`, {
      to_work_centre_id: toWorkCentreId,
      reason: reason || 'user_decision',
      new_position: newPosition
    });
  },

  startMove: async (id: number, orderNumber: string): Promise<{ message: string; orderId: string; lockedBy: string }> => {
    return api.post(`/orders/${id}/start-move`, { orderNumber });
  },

  endMove: async (id: number, completed: boolean): Promise<{ message: string }> => {
    return api.post(`/orders/${id}/end-move`, { completed });
  },

  getSteps: async (id: number): Promise<{ steps: any[] }> => {
    return api.get(`/orders/${id}/steps`);
  },

  startStep: async (orderId: number, stepId: number): Promise<{ message: string; step: any }> => {
    return api.post(`/orders/${orderId}/steps/${stepId}/start`);
  },

  completeStep: async (orderId: number, stepId: number, quantityCompleted: number): Promise<{ message: string; step: any }> => {
    return api.post(`/orders/${orderId}/steps/${stepId}/complete`, {
      quantity_completed: quantityCompleted,
    });
  },

  bulkImport: async (orders: any[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    details: Array<{
      order_number: string;
      status: 'created' | 'updated' | 'skipped' | 'error';
      message: string;
    }>;
  }> => {
    return api.post('/orders/import', orders);
  },

  reorder: async (workCentreId: number, orderPositions: Array<{ order_id: number; position: number }>): Promise<{ message: string; updated_count: number }> => {
    return api.post('/orders/reorder', {
      work_centre_id: workCentreId,
      order_positions: orderPositions
    });
  },
};

// Work centres services
export const workCentresService = {
  getAll: async (includeInactive: boolean = false): Promise<WorkCentresResponse> => {
    const endpoint = includeInactive ? '/work-centres?include_inactive=true' : '/work-centres';
    return api.get<WorkCentresResponse>(endpoint);
  },

  getById: async (id: number): Promise<{ work_centre: WorkCentre }> => {
    return api.get(`/work-centres/${id}`);
  },

  create: async (workCentreData: {
    name: string;
    code: string;
    description?: string;
    capacity: number;
    display_order?: number;
  }): Promise<{ message: string; work_centre: WorkCentre }> => {
    return api.post('/work-centres', workCentreData);
  },

  update: async (id: number, updates: Partial<WorkCentre>): Promise<{ message: string; work_centre: WorkCentre }> => {
    return api.put(`/work-centres/${id}`, updates);
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/work-centres/${id}`);
  },

  reorder: async (reorderData: Array<{ id: number; display_order: number }>): Promise<{ message: string }> => {
    return api.put('/work-centres/reorder', reorderData);
  },

  addMachine: async (workCentreId: number, machineData: {
    name: string;
    code: string;
    description?: string;
  }): Promise<{ message: string; machine: any }> => {
    return api.post(`/work-centres/${workCentreId}/machines`, machineData);
  },

  updateMachine: async (workCentreId: number, machineId: number, updates: any): Promise<{ message: string; machine: any }> => {
    return api.put(`/work-centres/${workCentreId}/machines/${machineId}`, updates);
  },

  deleteMachine: async (workCentreId: number, machineId: number): Promise<{ message: string }> => {
    return api.delete(`/work-centres/${workCentreId}/machines/${machineId}`);
  },
};

// Planning board services
export const planningBoardService = {
  getData: async (): Promise<PlanningBoardResponse> => {
    return api.get<PlanningBoardResponse>('/planning-board');
  },

  moveOrder: async (orderData: {
    orderId: number;
    fromWorkCentreId: number;
    toWorkCentreId: number;
    reason?: string;
  }): Promise<{ message: string; order: ManufacturingOrder }> => {
    return api.put('/planning-board/move', orderData);
  },

  getStats: async (): Promise<any> => {
    return api.get('/planning-board/stats');
  },
};

// Analytics services
export const analyticsService = {
  getDashboard: async (): Promise<DashboardMetrics> => {
    return api.get<DashboardMetrics>('/analytics/dashboard');
  },

  getWorkCentreAnalytics: async (workCentreId?: number): Promise<any> => {
    const endpoint = workCentreId 
      ? `/analytics/work-centres/${workCentreId}`
      : '/analytics/work-centres';
    return api.get(endpoint);
  },

  getOrderAnalytics: async (filters?: any): Promise<any> => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const endpoint = queryParams.toString() ? `/analytics/orders?${queryParams}` : '/analytics/orders';
    return api.get(endpoint);
  },

  getProductionMetrics: async (period?: string): Promise<any> => {
    const endpoint = period ? `/analytics/production?period=${period}` : '/analytics/production';
    return api.get(endpoint);
  },
};

// Users services (admin only)
export const usersService = {
  getAll: async (): Promise<{ users: User[] }> => {
    return api.get<{ users: User[] }>('/users');
  },

  getById: async (id: number): Promise<{ user: User }> => {
    return api.get(`/users/${id}`);
  },

  create: async (userData: {
    username: string;
    email: string;
    password: string;
    role: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{ message: string; user: User }> => {
    return api.post('/users', userData);
  },

  update: async (id: number, updates: Partial<User>): Promise<{ message: string; user: User }> => {
    return api.put(`/users/${id}`, updates);
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return api.delete(`/users/${id}`);
  },

  updateRole: async (id: number, role: string): Promise<{ message: string; user: User }> => {
    return api.put(`/users/${id}/role`, { role });
  },

  toggleActive: async (id: number): Promise<{ message: string; user: User }> => {
    return api.put(`/users/${id}/toggle-active`);
  },
};

// Health check
export const healthService = {
  check: async (): Promise<{ status: string; timestamp: string; environment: string }> => {
    return api.get('/health');
  },
};

// API Key services
export const apiKeysService = {
  getAll: async (): Promise<ApiKey[]> => {
    const response = await api.get<ApiKeysResponse>('/api/admin/api-keys');
    return response.data;
  },

  getById: async (id: number): Promise<ApiKey> => {
    const response = await api.get<ApiKeyResponse>(`/api/admin/api-keys/${id}`);
    return response.data;
  },

  create: async (data: ApiKeyCreate): Promise<ApiKeyCreateResponse> => {
    return api.post<ApiKeyCreateResponse>('/api/admin/api-keys', data);
  },

  update: async (id: number, data: ApiKeyUpdate): Promise<ApiKey> => {
    const response = await api.put<ApiKeyResponse>(`/api/admin/api-keys/${id}`, data);
    return response.data;
  },

  rotate: async (id: number): Promise<ApiKeyRotateResponse> => {
    return api.post<ApiKeyRotateResponse>(`/api/admin/api-keys/${id}/rotate`);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/admin/api-keys/${id}`);
  },

  getUsage: async (keyId: string, timeRange: string): Promise<ApiKeyUsage> => {
    const response = await api.get<ApiKeyUsageResponse>(`/api/admin/api-keys/${keyId}/usage?timeRange=${timeRange}`);
    return response.data;
  }
};
import apiClient from './apiConfig';

export interface InventoryItem {
  id: number;
  product_id?: number;
  name: string;
  quantity: number;
  unit: string;
  reorder_level?: number;
  product?: any;
  created_at?: string;
  updated_at?: string;
}

export interface CreateInventoryRequest {
  product_id?: number;
  name: string;
  quantity: number;
  unit: string;
  reorder_level?: number;
}

export interface StockMovement {
  id: number;
  movement_type: 'purchase' | 'adjustment' | 'sale' | 'transfer';
  quantity: number;
  unit_cost?: number;
  reference_id?: number;
  notes?: string;
  created_at?: string;
}

export interface InventoryDailySummary {
  inventory_item_id: number;
  beginning_today: number;
  added_today: number;
  deducted_today: number;
  current_quantity: number;
  opening_inputted?: number | null;
}

const inventoryService = {
  getAll: async (): Promise<InventoryItem[]> => {
    const response = await apiClient.get('/inventory');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<InventoryItem> => {
    const response = await apiClient.get(`/inventory/${id}`);
    return response.data.data;
  },

  create: async (data: CreateInventoryRequest): Promise<InventoryItem> => {
    const response = await apiClient.post('/inventory', data);
    return response.data.data;
  },

  update: async (id: number, data: CreateInventoryRequest): Promise<InventoryItem> => {
    const response = await apiClient.put(`/inventory/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<any> => {
    const response = await apiClient.delete(`/inventory/${id}`);
    return response.data;
  },

  addMovement: async (
    id: number,
    movementData: {
      movement_type: string;
      quantity: number;
      unit_cost?: number;
      reference_id?: number;
      notes?: string;
      opening_inputted?: number;
    }
  ): Promise<StockMovement> => {
    const response = await apiClient.post(`/inventory/${id}/movements`, movementData);
    return response.data.data;
  },

  getMovements: async (id: number): Promise<StockMovement[]> => {
    const response = await apiClient.get(`/inventory/${id}/movements`);
    return response.data.data || [];
  },

  getDailySummary: async (date?: string): Promise<InventoryDailySummary[]> => {
    const response = await apiClient.get('/inventory/daily-summary', {
      params: date ? { date } : undefined,
    });
    return response.data.data || [];
  },
};

export default inventoryService;

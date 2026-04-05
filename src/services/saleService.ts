import apiClient from './apiConfig';

export interface SaleItem {
  id?: number;
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  cost?: number;
}

export interface Sale {
  id: number;
  public_reference: string;
  user_id?: number | null;
  customer_id?: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  status?: string;
  user?: any;
  customer?: any;
  saleItems?: SaleItem[];
  payments?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateSaleRequest {
  user_id?: number;
  customer_id?: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  items: SaleItem[];
}

export interface DailySalesSummary {
  total_revenue: number;
  total_transactions: number;
  total_items: number;
  date: string;
}

export interface DailySalesResponse {
  sales: Sale[];
  summary: DailySalesSummary;
}

const saleService = {
  getAll: async (): Promise<Sale[]> => {
    const response = await apiClient.get('/sales');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Sale> => {
    const response = await apiClient.get(`/sales/${id}`);
    return response.data.data;
  },

  create: async (data: CreateSaleRequest): Promise<Sale> => {
    const response = await apiClient.post('/sales', data);
    return response.data.data;
  },

  getSalesByDateRange: async (startDate: string, endDate: string): Promise<Sale[]> => {
    const response = await apiClient.get('/sales/date-range', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data.data || [];
  },

  getDailySales: async (): Promise<DailySalesResponse> => {
    const response = await apiClient.get('/sales/daily/today');
    const data = response.data?.data || {};
    return {
      sales: Array.isArray(data.sales) ? data.sales : [],
      summary: {
        total_revenue: Number(data.summary?.total_revenue || 0),
        total_transactions: Number(data.summary?.total_transactions || 0),
        total_items: Number(data.summary?.total_items || 0),
        date: String(data.summary?.date || ''),
      },
    };
  },

  recordPayment: async (
    saleId: number,
    paymentData: {
      method: string;
      amount: number;
      details?: any;
    }
  ): Promise<any> => {
    const response = await apiClient.post(`/sales/${saleId}/payment`, paymentData);
    return response.data;
  },
};

export default saleService;

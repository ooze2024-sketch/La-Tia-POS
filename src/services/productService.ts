import apiClient from './apiConfig';

export interface Product {
  id: number;
  sku?: string;
  name: string;
  category_id: number;
  category?: any;
  cost: number;
  price: number;
  description?: string;
  is_active?: boolean;
  image_path?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductRequest {
  sku?: string;
  name: string;
  category_id: number;
  cost: number;
  price: number;
  description?: string;
  is_active?: boolean;
}

export interface ProductIngredient {
  id: number;
  product_id: number;
  inventory_item_id: number;
  quantity: number;
  inventoryItem?: any;
}

const productService = {
  getAll: async (): Promise<Product[]> => {
    const response = await apiClient.get('/products');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  getByCategory: async (categoryId: number): Promise<Product[]> => {
    const response = await apiClient.get(`/products/category/${categoryId}`);
    return response.data.data || [];
  },

  create: async (data: CreateProductRequest): Promise<Product> => {
    const response = await apiClient.post('/products', data);
    return response.data.data;
  },

  update: async (id: number, data: CreateProductRequest): Promise<Product> => {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<any> => {
    const response = await apiClient.delete(`/products/${id}`);
    return response.data;
  },

  // Ingredient methods
  getIngredients: async (productId: number): Promise<ProductIngredient[]> => {
    const response = await apiClient.get(`/products/${productId}/ingredients`);
    return response.data.data || [];
  },

  getMultipleIngredients: async (productIds: number[]): Promise<{ [key: number]: ProductIngredient[] }> => {
    const response = await apiClient.post('/products/ingredients/batch', {
      product_ids: productIds,
    });
    return response.data.data || {};
  },

  saveIngredients: async (
    productId: number,
    ingredients: Array<{ inventory_item_id: number; quantity: number }>
  ): Promise<ProductIngredient[]> => {
    const response = await apiClient.post(`/products/${productId}/ingredients`, {
      ingredients,
    });
    return response.data.data || [];
  },

  deleteIngredient: async (ingredientId: number): Promise<any> => {
    const response = await apiClient.delete(`/product-ingredients/${ingredientId}`);
    return response.data;
  },

  updateIngredientQuantity: async (
    ingredientId: number,
    quantity: number
  ): Promise<ProductIngredient> => {
    const response = await apiClient.put(`/product-ingredients/${ingredientId}`, {
      quantity,
    });
    return response.data.data;
  },
};

export default productService;

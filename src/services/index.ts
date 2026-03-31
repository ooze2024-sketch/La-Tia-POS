export { default as authService } from './authService';
export { default as categoryService } from './categoryService';
export { default as productService } from './productService';
export { default as inventoryService } from './inventoryService';
export { default as saleService } from './saleService';
export { default as dashboardService } from './dashboardService';
export { default as ingredientsService } from './ingredientsService';
export { productImageService } from './productImageService';
export { default as apiClient } from './apiConfig';

export * from './authService';
export * from './categoryService';
export * from './productService';
export * from './inventoryService';
export * from './saleService';
export * from './dashboardService';
export type {
	LinkIngredientsRequest,
	ProductIngredient as LinkedIngredient,
} from './ingredientsService';
export * from './productImageService';

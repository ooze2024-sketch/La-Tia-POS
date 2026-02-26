<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\InventoryController;

Route::prefix('api/v1')->group(function () {
    // Category routes
    Route::apiResource('categories', CategoryController::class);
    
    // Product routes
    Route::apiResource('products', ProductController::class);
    Route::get('products/category/{categoryId}', [ProductController::class, 'byCategory']);
    
    // Inventory routes
    Route::apiResource('inventory', InventoryController::class);
    Route::get('inventory/low-stock', [InventoryController::class, 'lowStock']);
    Route::get('inventory/out-of-stock', [InventoryController::class, 'outOfStock']);
});

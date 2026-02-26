<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    /**
     * Get all products.
     */
    public function index(): JsonResponse
    {
        $products = Product::with('category')->get();
        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Get a single product by ID.
     */
    public function show($id): JsonResponse
    {
        $product = Product::with('category')->findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    /**
     * Create a new product.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'required|integer|exists:categories,id',
            'cost' => 'required|numeric|min:0',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'sku' => 'nullable|string|unique:products,sku',
        ]);

        $product = Product::create($validated);
        $product->load('category');
        
        return response()->json([
            'success' => true,
            'data' => $product,
        ], 201);
    }

    /**
     * Update an existing product.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        
        $validated = $request->validate([
            'name' => 'string|max:255',
            'category_id' => 'integer|exists:categories,id',
            'cost' => 'numeric|min:0',
            'price' => 'numeric|min:0',
            'description' => 'nullable|string',
            'sku' => 'nullable|string|unique:products,sku,' . $id,
        ]);

        $product->update($validated);
        $product->load('category');
        
        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    /**
     * Delete a product.
     */
    public function destroy($id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
        ]);
    }

    /**
     * Get products by category.
     */
    public function byCategory($categoryId): JsonResponse
    {
        $products = Product::where('category_id', $categoryId)->with('category')->get();
        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }
}

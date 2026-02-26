<?php

namespace App\Http\Controllers\Api;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    /**
     * Get all categories.
     */
    public function index(): JsonResponse
    {
        $categories = Category::all();
        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get a single category by ID.
     */
    public function show($id): JsonResponse
    {
        $category = Category::findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => $category,
        ]);
    }

    /**
     * Create a new category.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:categories,name|max:120',
            'description' => 'nullable|string',
        ]);

        $category = Category::create($validated);
        return response()->json([
            'success' => true,
            'data' => $category,
        ], 201);
    }

    /**
     * Update an existing category.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $category = Category::findOrFail($id);
        
        $validated = $request->validate([
            'name' => 'required|string|unique:categories,name,' . $id . '|max:120',
            'description' => 'nullable|string',
        ]);

        $category->update($validated);
        return response()->json([
            'success' => true,
            'data' => $category,
        ]);
    }

    /**
     * Delete a category and its products (cascading).
     */
    public function destroy($id): JsonResponse
    {
        $category = Category::findOrFail($id);
        $category->delete(); // Products cascade delete via the model booted hook
        return response()->json([
            'success' => true,
            'message' => 'Category and associated products deleted successfully',
        ]);
    }
}

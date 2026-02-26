<?php

namespace App\Http\Controllers\Api;

use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class InventoryController extends Controller
{
    /**
     * Get all inventory items.
     */
    public function index(): JsonResponse
    {
        $items = InventoryItem::all();
        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    /**
     * Get a single inventory item by ID.
     */
    public function show($id): JsonResponse
    {
        $item = InventoryItem::findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    /**
     * Create a new inventory item.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0',
            'unit' => 'required|string|max:32',
            'product_id' => 'nullable|integer|exists:products,id',
            'reorder_level' => 'nullable|numeric|min:0',
        ]);

        $item = InventoryItem::create($validated);
        return response()->json([
            'success' => true,
            'data' => $item,
        ], 201);
    }

    /**
     * Update an existing inventory item.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $item = InventoryItem::findOrFail($id);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'quantity' => 'numeric|min:0',
            'unit' => 'string|max:32',
            'product_id' => 'nullable|integer|exists:products,id',
            'reorder_level' => 'nullable|numeric|min:0',
        ]);

        $item->update($validated);
        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    /**
     * Delete an inventory item.
     */
    public function destroy($id): JsonResponse
    {
        $item = InventoryItem::findOrFail($id);
        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'Inventory item deleted successfully',
        ]);
    }

    /**
     * Get low stock items (quantity < reorder_level).
     */
    public function lowStock(): JsonResponse
    {
        $items = InventoryItem::whereRaw('quantity < COALESCE(reorder_level, 10)')->get();
        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    /**
     * Get out of stock items (quantity = 0).
     */
    public function outOfStock(): JsonResponse
    {
        $items = InventoryItem::where('quantity', 0)->get();
        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }
}

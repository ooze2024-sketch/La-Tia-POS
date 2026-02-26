<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $table = 'inventory_items';

    protected $fillable = [
        'product_id',
        'name',
        'quantity',
        'unit',
        'reorder_level',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'reorder_level' => 'decimal:3',
    ];

    public $timestamps = true;

    /**
     * An inventory item may belong to a product.
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

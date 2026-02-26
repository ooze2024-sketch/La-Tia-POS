<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = ['name', 'description'];
    public $timestamps = true;

    /**
     * A category has many products.
     */
    public function products()
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Cascade delete products when category is deleted.
     */
    protected static function booted()
    {
        static::deleting(function ($category) {
            $category->products()->delete();
        });
    }
}

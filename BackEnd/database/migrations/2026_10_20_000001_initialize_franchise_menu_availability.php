<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchises')
            || ! Schema::hasTable('products')
            || ! Schema::hasTable('franchise_inventory')) {
            return;
        }

        $now = now();
        DB::table('franchises')
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($franchises) use ($now): void {
                foreach ($franchises as $franchise) {
                    $products = DB::table('products')
                        ->whereNull('franchise_id')
                        ->orWhere('franchise_id', $franchise->id)
                        ->get(['id', 'is_available']);

                    foreach ($products->chunk(500) as $productChunk) {
                        DB::table('franchise_inventory')->insertOrIgnore(
                            $productChunk->map(fn ($product) => [
                                'franchise_id' => $franchise->id,
                                'product_id' => $product->id,
                                'stock_quantity' => null,
                                'is_available' => $product->is_available,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ])->all()
                        );
                    }
                }
            });
    }

    public function down(): void
    {
    }
};

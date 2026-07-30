<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Normalize names and find duplicates (case-insensitive, trimmed)
        $groups = [];

        $products = DB::table('products')->get();

        foreach ($products as $p) {
            $norm = strtoupper(trim($p->name));
            $norm = preg_replace('/\s+/', ' ', $norm);
            $groups[$norm][] = (array) $p;
        }

        // For each group with more than one product, keep the earliest created_at
        foreach ($groups as $norm => $items) {
            if (count($items) <= 1) continue;

            usort($items, function ($a, $b) {
                $ta = $a['created_at'] ?? null;
                $tb = $b['created_at'] ?? null;
                if ($ta === $tb) return 0;
                if ($ta === null) return 1;
                if ($tb === null) return -1;
                return strcmp($ta, $tb);
            });

            $keeper = array_shift($items);
            $keeperId = $keeper['id'];

            foreach ($items as $dup) {
                $dupId = $dup['id'];

                // Update orders' items JSON to point product_id references to keeperId
                $orders = DB::table('orders')->where('items', 'like', '%"product_id":"'.$dupId.'"%')->get();
                foreach ($orders as $order) {
                    $itemsJson = json_decode($order->items, true);
                    $changed = false;
                    if (is_array($itemsJson)) {
                        foreach ($itemsJson as &$it) {
                            if (isset($it['product_id']) && $it['product_id'] === $dupId) {
                                $it['product_id'] = $keeperId;
                                $changed = true;
                            }
                        }
                    }

                    if ($changed) {
                        DB::table('orders')->where('id', $order->id)->update(['items' => json_encode($itemsJson)]);
                    }
                }

                // Delete duplicate product row
                DB::table('products')->where('id', $dupId)->delete();
            }
        }

        // Finally, add a unique index on normalized name to prevent future duplicates
        Schema::table('products', function (Blueprint $table) {
            // we add a case-insensitive unique index on lower(name)
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique_ci ON products (LOWER(TRIM(name)));');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            DB::statement('DROP INDEX IF EXISTS products_name_unique_ci');
        });
    }
};

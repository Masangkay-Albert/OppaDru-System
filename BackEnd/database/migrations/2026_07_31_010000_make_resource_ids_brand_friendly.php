<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('id', 100)->change();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('id', 100)->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('id', 100)->change();
        });

        $productIdMap = [];

        foreach (DB::table('products')->get() as $product) {
            $newProductId = $this->generateUniqueProductId($product->name);
            DB::table('products')->where('id', $product->id)->update(['id' => $newProductId]);
            $productIdMap[$product->id] = $newProductId;
        }

        foreach (DB::table('orders')->get() as $order) {
            $items = json_decode($order->items, true) ?: [];

            foreach ($items as &$item) {
                if (isset($productIdMap[$item['product_id']])) {
                    $item['product_id'] = $productIdMap[$item['product_id']];
                }
            }

            $newOrderId = $this->generateUniqueOrderId($order->created_at);
            $newOrderNumber = $this->generateUniqueOrderNumber($order->created_at);

            DB::table('orders')
                ->where('id', $order->id)
                ->update([
                    'id' => $newOrderId,
                    'order_number' => $newOrderNumber,
                    'items' => json_encode($items),
                ]);
        }

        foreach (DB::table('users')->get() as $user) {
            $newUserId = $this->generateUniqueUserId($user->full_name);
            DB::table('users')->where('id', $user->id)->update(['id' => $newUserId]);
        }
    }

    public function down(): void
    {
        // This migration intentionally does not revert generated IDs safely.
    }

    private function generateUserId(string $fullName): string
    {
        $slug = Str::upper(Str::slug($fullName ?: 'customer', ''));
        $slug = preg_replace('/[^A-Z0-9]/', '', $slug);
        $slug = substr($slug, 0, 16);

        return 'OPPA-USER-' . ($slug ?: 'CUST') . '-' . strtoupper(Str::random(4));
    }

    private function generateUniqueUserId(string $fullName): string
    {
        do {
            $id = $this->generateUserId($fullName);
        } while (DB::table('users')->where('id', $id)->exists());

        return $id;
    }

    private function generateProductId(string $productName): string
    {
        $slug = Str::upper(Str::slug($productName ?: 'food-item', ''));
        $slug = preg_replace('/[^A-Z0-9]/', '', $slug);
        $slug = substr($slug, 0, 20);

        return 'OPPA-PROD-' . ($slug ?: 'ITEM') . '-' . strtoupper(Str::random(4));
    }

    private function generateUniqueProductId(string $productName): string
    {
        do {
            $id = $this->generateProductId($productName);
        } while (DB::table('products')->where('id', $id)->exists());

        return $id;
    }

    private function generateOrderId(string $createdAt = null): string
    {
        $date = $createdAt ? date('Ymd', strtotime($createdAt)) : date('Ymd');
        return 'OPPA-ORD-' . $date . '-' . strtoupper(Str::random(6));
    }

    private function generateUniqueOrderId(string $createdAt = null): string
    {
        do {
            $id = $this->generateOrderId($createdAt);
        } while (DB::table('orders')->where('id', $id)->exists());

        return $id;
    }

    private function generateOrderNumber(string $createdAt = null): string
    {
        $date = $createdAt ? date('Ymd', strtotime($createdAt)) : date('Ymd');
        return 'OPPA-ORD-' . $date . '-' . strtoupper(Str::random(8));
    }

    private function generateUniqueOrderNumber(string $createdAt = null): string
    {
        do {
            $orderNumber = $this->generateOrderNumber($createdAt);
        } while (DB::table('orders')->where('order_number', $orderNumber)->exists());

        return $orderNumber;
    }
};

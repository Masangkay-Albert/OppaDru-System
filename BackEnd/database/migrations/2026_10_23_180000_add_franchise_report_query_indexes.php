<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ORDERS_INDEX = 'orders_franchise_report_idx';

    private const ORDER_ITEMS_INDEX = 'order_items_report_product_idx';

    public function up(): void
    {
        if (Schema::hasTable('orders')
            && Schema::hasColumn('orders', 'franchise_id')
            && Schema::hasColumn('orders', 'created_at')
            && Schema::hasColumn('orders', 'status')
            && ! Schema::hasIndex('orders', self::ORDERS_INDEX)) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->index(['franchise_id', 'created_at', 'status'], self::ORDERS_INDEX);
            });
        }
        if (Schema::hasTable('order_items')
            && Schema::hasColumn('order_items', 'order_id')
            && Schema::hasColumn('order_items', 'product_id')
            && ! Schema::hasIndex('order_items', self::ORDER_ITEMS_INDEX)) {
            Schema::table('order_items', function (Blueprint $table): void {
                $table->index(['order_id', 'product_id'], self::ORDER_ITEMS_INDEX);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasIndex('orders', self::ORDERS_INDEX)) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropIndex(self::ORDERS_INDEX));
        }
        if (Schema::hasTable('order_items') && Schema::hasIndex('order_items', self::ORDER_ITEMS_INDEX)) {
            Schema::table('order_items', fn (Blueprint $table) => $table->dropIndex(self::ORDER_ITEMS_INDEX));
        }
    }
};

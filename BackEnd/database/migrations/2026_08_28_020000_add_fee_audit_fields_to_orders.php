<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_fee')) $table->decimal('delivery_fee', 10, 2)->nullable();
            if (!Schema::hasColumn('orders', 'delivery_distance_km')) $table->decimal('delivery_distance_km', 10, 3)->nullable();
            if (!Schema::hasColumn('orders', 'delivery_calculation_method')) $table->string('delivery_calculation_method')->nullable();
            if (!Schema::hasColumn('orders', 'delivery_type')) $table->string('delivery_type')->nullable();
            if (!Schema::hasColumn('orders', 'service_fee')) $table->decimal('service_fee', 10, 2)->nullable();
            if (!Schema::hasColumn('orders', 'priority_fee')) $table->decimal('priority_fee', 10, 2)->nullable();
            if (!Schema::hasColumn('orders', 'vat')) $table->decimal('vat', 10, 2)->nullable();
            if (!Schema::hasColumn('orders', 'service_fee_rule')) $table->string('service_fee_rule')->nullable();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders')) return;

        Schema::table('orders', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('orders', 'delivery_fee') ? 'delivery_fee' : null,
                Schema::hasColumn('orders', 'delivery_distance_km') ? 'delivery_distance_km' : null,
                Schema::hasColumn('orders', 'delivery_calculation_method') ? 'delivery_calculation_method' : null,
                Schema::hasColumn('orders', 'delivery_type') ? 'delivery_type' : null,
                Schema::hasColumn('orders', 'service_fee') ? 'service_fee' : null,
                Schema::hasColumn('orders', 'priority_fee') ? 'priority_fee' : null,
                Schema::hasColumn('orders', 'vat') ? 'vat' : null,
                Schema::hasColumn('orders', 'service_fee_rule') ? 'service_fee_rule' : null,
            ]));
            if ($columns !== []) $table->dropColumn($columns);
        });
    }
};
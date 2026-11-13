<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->decimal('total_cost', 12, 2)->nullable();
        });

        Schema::table('main_branch_ingredients', function (Blueprint $table) {
            $table->decimal('inventory_value', 14, 2)->nullable();
        });

        Schema::table('branch_ingredient_stocks', function (Blueprint $table) {
            $table->decimal('inventory_value', 14, 2)->nullable();
        });
    }

    public function down(): void
    {
        // Intentionally retain the added accounting data on rollback.
    }
};

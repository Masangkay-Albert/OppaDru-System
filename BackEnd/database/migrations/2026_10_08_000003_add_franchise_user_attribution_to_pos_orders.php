<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders') || !Schema::hasTable('franchise_users')) {
            return;
        }

        if (!Schema::hasColumn('orders', 'franchise_user_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('franchise_user_id', 100)->nullable();
                $table->foreign('franchise_user_id', 'orders_franchise_user_id_foreign')
                    ->references('id')
                    ->on('franchise_users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Keep transaction attribution data when rolling back application code.
    }
};

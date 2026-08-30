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
            if (!Schema::hasColumn('orders', 'delivery_type')) {
                $table->string('delivery_type')->nullable();
            }
            if (!Schema::hasColumn('orders', 'priority_fee')) {
                $table->decimal('priority_fee', 10, 2)->nullable();
            }
            if (!Schema::hasColumn('orders', 'vat')) {
                $table->decimal('vat', 10, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
    }
};
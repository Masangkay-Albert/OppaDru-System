<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('third_party_platform', 30)->nullable();
            $table->string('external_order_ref', 30)->nullable();
            $table->unique(
                ['branch_id', 'third_party_platform', 'external_order_ref'],
                'orders_branch_platform_ref_unique',
            );
        });
    }

    public function down(): void
    {
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_proof_image')) {
                $table->string('delivery_proof_image')->nullable();
            }
            if (!Schema::hasColumn('orders', 'delivery_proof_uploaded_at')) {
                $table->timestamp('delivery_proof_uploaded_at')->nullable();
            }
            if (!Schema::hasColumn('orders', 'delivery_confirmed_at')) {
                $table->timestamp('delivery_confirmed_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = array_filter([
                Schema::hasColumn('orders', 'delivery_proof_image') ? 'delivery_proof_image' : null,
                Schema::hasColumn('orders', 'delivery_proof_uploaded_at') ? 'delivery_proof_uploaded_at' : null,
                Schema::hasColumn('orders', 'delivery_confirmed_at') ? 'delivery_confirmed_at' : null,
            ]);

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
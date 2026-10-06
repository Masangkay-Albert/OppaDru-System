<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (! Schema::hasColumn('orders', 'delivery_proof_image_data')) {
                    $table->longText('delivery_proof_image_data')->nullable();
                }
                if (! Schema::hasColumn('orders', 'discount_proof_image_data')) {
                    $table->longText('discount_proof_image_data')->nullable();
                }
            });
        }

        if (Schema::hasTable('discount_applications')) {
            Schema::table('discount_applications', function (Blueprint $table) {
                if (! Schema::hasColumn('discount_applications', 'proof_image_data')) {
                    $table->longText('proof_image_data')->nullable();
                }
            });
        }

        if (Schema::hasTable('discount_verification_requests')) {
            Schema::table('discount_verification_requests', function (Blueprint $table) {
                if (! Schema::hasColumn('discount_verification_requests', 'proof_image_data')) {
                    $table->longText('proof_image_data')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ([
            'orders' => ['delivery_proof_image_data', 'discount_proof_image_data'],
            'discount_applications' => ['proof_image_data'],
            'discount_verification_requests' => ['proof_image_data'],
        ] as $tableName => $columns) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            foreach ($columns as $column) {
                if (Schema::hasColumn($tableName, $column)) {
                    Schema::table($tableName, fn (Blueprint $table) => $table->dropColumn($column));
                }
            }
        }
    }
};

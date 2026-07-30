<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        $needsCreatedAt = ! Schema::hasColumn('orders', 'created_at');
        $needsUpdatedAt = ! Schema::hasColumn('orders', 'updated_at');

        if (! $needsCreatedAt && ! $needsUpdatedAt) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) use ($needsCreatedAt, $needsUpdatedAt) {
            if ($needsCreatedAt) {
                $table->timestamp('created_at')->nullable();
            }

            if ($needsUpdatedAt) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        $dropColumns = array_values(array_filter([
            Schema::hasColumn('orders', 'created_at') ? 'created_at' : null,
            Schema::hasColumn('orders', 'updated_at') ? 'updated_at' : null,
        ]));

        if ($dropColumns === []) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) use ($dropColumns) {
            $table->dropColumn($dropColumns);
        });
    }
};

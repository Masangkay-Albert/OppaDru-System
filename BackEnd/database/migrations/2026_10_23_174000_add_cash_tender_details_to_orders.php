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

        Schema::table('orders', function (Blueprint $table): void {
            if (! Schema::hasColumn('orders', 'cash_tendered')) {
                $table->decimal('cash_tendered', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('orders', 'change_due')) {
                $table->decimal('change_due', 10, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $columns = array_filter([
                Schema::hasColumn('orders', 'cash_tendered') ? 'cash_tendered' : null,
                Schema::hasColumn('orders', 'change_due') ? 'change_due' : null,
            ]);
            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};

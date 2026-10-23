<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CASHIER_BRANCH_CREATED_INDEX = 'orders_cashier_branch_created_idx';

    private const STATUS_INDEX = 'orders_status_index';

    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->index(
                ['cashier_employee_id', 'branch_id', 'created_at'],
                self::CASHIER_BRANCH_CREATED_INDEX
            );
            $table->index('status', self::STATUS_INDEX);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(self::CASHIER_BRANCH_CREATED_INDEX);
            $table->dropIndex(self::STATUS_INDEX);
        });
    }
};

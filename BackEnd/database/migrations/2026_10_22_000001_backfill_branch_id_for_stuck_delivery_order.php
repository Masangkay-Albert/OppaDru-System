<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')
            ->where(function ($query): void {
                $query->where('order_number', 'OPPA-ORD-20261021-Y27WTJNH')
                    ->orWhere('id', 'OPPA-ORD-20261021-Y27WTJNH');
            })
            ->whereNull('branch_id')
            ->whereNotNull('franchise_id')
            ->update(['branch_id' => DB::raw('franchise_id')]);
    }

    public function down(): void
    {
        // Preserve the repaired branch attribution on rollback.
    }
};

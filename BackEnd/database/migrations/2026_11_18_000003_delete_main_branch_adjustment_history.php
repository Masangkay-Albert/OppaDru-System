<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('stock_movements')
            ->whereNull('branch_id')
            ->whereIn('type', ['adjustment', 'count_adjustment'])
            ->delete();
    }

    public function down(): void
    {
        // Permanently deleted history cannot be restored.
    }
};

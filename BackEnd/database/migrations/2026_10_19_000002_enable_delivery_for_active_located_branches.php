<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchises')) {
            return;
        }

        DB::table('franchises')
            ->where('status', 'active')
            ->where('is_active', true)
            ->whereBetween('latitude', [4, 22])
            ->whereBetween('longitude', [116, 127])
            ->update([
                'accepts_online_orders' => true,
                'delivery_enabled' => true,
            ]);
    }

    public function down(): void
    {
        // Availability flags are derived from current branch readiness.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const BRANCH_NAME = 'Oppa Dru Korean Fried Chicken - Laguna';

    public function up(): void
    {
        if (! Schema::hasTable('franchises') || ! Schema::hasColumn('franchises', 'delivery_radius_km')) {
            return;
        }

        DB::table('franchises')
            ->whereRaw('LOWER(name) = ?', [strtolower(self::BRANCH_NAME)])
            ->update(['delivery_radius_km' => 40]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchises') || ! Schema::hasColumn('franchises', 'delivery_radius_km')) {
            return;
        }

        DB::table('franchises')
            ->whereRaw('LOWER(name) = ?', [strtolower(self::BRANCH_NAME)])
            ->where('delivery_radius_km', 40)
            ->update(['delivery_radius_km' => 15]);
    }
};

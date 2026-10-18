<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchises')) {
            Schema::table('franchises', function (Blueprint $table) {
                if (! Schema::hasColumn('franchises', 'latitude')) $table->decimal('latitude', 10, 7)->nullable();
                if (! Schema::hasColumn('franchises', 'longitude')) $table->decimal('longitude', 10, 7)->nullable();
                if (! Schema::hasColumn('franchises', 'is_active')) $table->boolean('is_active')->default(true);
                if (! Schema::hasColumn('franchises', 'accepts_online_orders')) $table->boolean('accepts_online_orders')->default(true);
                if (! Schema::hasColumn('franchises', 'delivery_enabled')) $table->boolean('delivery_enabled')->default(true);
                if (! Schema::hasColumn('franchises', 'delivery_radius_km')) $table->decimal('delivery_radius_km', 8, 2)->nullable();
                if (! Schema::hasColumn('franchises', 'is_main')) $table->boolean('is_main')->default(false);
            });

            // These are deployment data values, not application constants. Override them
            // through environment values when the production coordinates are known.
            $main = DB::table('franchises')->where('is_main', true)->first();
            if (! $main) {
                DB::table('franchises')->insert([
                    'id' => 'OPPA-FR-MAIN',
                    'name' => env('MAIN_BRANCH_NAME', 'Oppa Dru Korean Fried Chicken'),
                    'slug' => 'main-branch',
                    'address' => env('MAIN_BRANCH_ADDRESS'),
                    'latitude' => env('MAIN_BRANCH_LATITUDE') ?: DB::table('system_settings')->where('key', 'merchant_latitude')->value('value'),
                    'longitude' => env('MAIN_BRANCH_LONGITUDE') ?: DB::table('system_settings')->where('key', 'merchant_longitude')->value('value'),
                    'status' => 'active',
                    'is_active' => true,
                    'accepts_online_orders' => true,
                    'delivery_enabled' => true,
                    'is_main' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('franchises')->where('id', 'OPPA-FR-P4G0PFQ2')->update([
                'latitude' => env('LAGUNA_BRANCH_LATITUDE', 14.318056),
                'longitude' => env('LAGUNA_BRANCH_LONGITUDE', 121.101111),
                'is_active' => true,
                'accepts_online_orders' => true,
                'delivery_enabled' => true,
                'updated_at' => now(),
            ]);
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (! Schema::hasColumn('orders', 'branch_id')) $table->string('branch_id', 100)->nullable()->index();
                if (! Schema::hasColumn('orders', 'distance_km')) $table->decimal('distance_km', 8, 3)->nullable();
            });

            $mainId = DB::table('franchises')->where('is_main', true)->value('id');
            if ($mainId) {
                DB::table('orders')->whereNull('branch_id')->update(['branch_id' => DB::raw("COALESCE(franchise_id, '{$mainId}')")]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders')) Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'branch_id')) $table->dropColumn('branch_id');
            if (Schema::hasColumn('orders', 'distance_km')) $table->dropColumn('distance_km');
        });
        if (Schema::hasTable('franchises')) Schema::table('franchises', function (Blueprint $table) {
            foreach (['latitude', 'longitude', 'is_active', 'accepts_online_orders', 'delivery_enabled', 'delivery_radius_km', 'is_main'] as $column) {
                if (Schema::hasColumn('franchises', $column)) $table->dropColumn($column);
            }
        });
    }
};

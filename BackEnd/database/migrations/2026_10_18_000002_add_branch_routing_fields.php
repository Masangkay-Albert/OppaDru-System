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

            // Branch identity and coordinates belong to the branch record. This
            // migration only adds the routing columns; administrators populate
            // branch data through the branch management API.
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

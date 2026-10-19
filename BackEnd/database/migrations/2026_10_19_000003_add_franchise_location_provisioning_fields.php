<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchises')) {
            return;
        }

        Schema::table('franchises', function (Blueprint $table) {
            if (! Schema::hasColumn('franchises', 'location_status')) {
                $table->string('location_status')->default('needs_location');
            }
            if (! Schema::hasColumn('franchises', 'location_error')) {
                $table->text('location_error')->nullable();
            }
            if (Schema::hasColumn('franchises', 'accepts_online_orders')) {
                $table->boolean('accepts_online_orders')->default(true)->change();
            }
            if (Schema::hasColumn('franchises', 'delivery_enabled')) {
                $table->boolean('delivery_enabled')->default(true)->change();
            }
            if (Schema::hasColumn('franchises', 'delivery_radius_km')) {
                $table->decimal('delivery_radius_km', 8, 2)->nullable()->default(15)->change();
            }
        });

        DB::table('franchises')->whereNotNull('latitude')->whereNotNull('longitude')
            ->where('location_status', 'needs_location')
            ->update(['location_status' => 'geocoded']);
        DB::table('franchises')->whereNull('delivery_radius_km')
            ->update(['delivery_radius_km' => 15]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchises')) {
            return;
        }

        Schema::table('franchises', function (Blueprint $table) {
            foreach (['location_status', 'location_error'] as $column) {
                if (Schema::hasColumn('franchises', $column)) {
                    $table->dropColumn($column);
                }
            }
            if (Schema::hasColumn('franchises', 'delivery_radius_km')) {
                $table->decimal('delivery_radius_km', 8, 2)->nullable()->default(null)->change();
            }
        });
    }
};

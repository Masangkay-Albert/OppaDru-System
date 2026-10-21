<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchises') || ! Schema::hasColumn('franchises', 'delivery_radius_km')) {
            return;
        }

        Schema::table('franchises', function (Blueprint $table) {
            $table->decimal('delivery_radius_km', 8, 2)->nullable()->default(15)->change();
        });

        DB::table('franchises')->update(['delivery_radius_km' => 15]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchises') || ! Schema::hasColumn('franchises', 'delivery_radius_km')) {
            return;
        }

        Schema::table('franchises', function (Blueprint $table) {
            $table->decimal('delivery_radius_km', 8, 2)->nullable()->default(25)->change();
        });

        DB::table('franchises')->update(['delivery_radius_km' => 25]);
    }
};

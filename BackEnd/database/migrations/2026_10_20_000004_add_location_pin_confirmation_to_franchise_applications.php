<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')
            || Schema::hasColumn('franchise_applications', 'proposed_location_pin_confirmed')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            $table->boolean('proposed_location_pin_confirmed')->default(false);
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications')
            && Schema::hasColumn('franchise_applications', 'proposed_location_pin_confirmed')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropColumn('proposed_location_pin_confirmed');
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications') || Schema::hasColumn('franchise_applications', 'property_status')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            $table->string('property_status', 20)->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications') && Schema::hasColumn('franchise_applications', 'property_status')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropColumn('property_status');
            });
        }
    }
};

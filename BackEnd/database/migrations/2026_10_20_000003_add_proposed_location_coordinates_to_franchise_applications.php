<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('franchise_applications', 'proposed_latitude')) {
                $table->decimal('proposed_latitude', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'proposed_longitude')) {
                $table->decimal('proposed_longitude', 10, 7)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            foreach (['proposed_latitude', 'proposed_longitude'] as $column) {
                if (Schema::hasColumn('franchise_applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

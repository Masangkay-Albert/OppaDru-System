<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('employees')) {
            return;
        }

        if (Schema::hasColumn('employees', 'position')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->string('position')->default('cashier')->change();
            });
        }

        if (Schema::hasColumn('employees', 'franchise_id')
            && !Schema::hasIndex('employees', 'employees_franchise_location_index')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->index('franchise_id', 'employees_franchise_location_index');
            });
        }
    }

    public function down(): void
    {
        // Keep role/location assignments intact when rolling back application code.
    }
};

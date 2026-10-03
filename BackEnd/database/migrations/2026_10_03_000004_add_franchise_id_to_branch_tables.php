<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('franchises')) {
            return;
        }

        foreach (['orders', 'products', 'addon_groups', 'addons', 'employees', 'drivers', 'system_settings', 'discount_applications'] as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::hasColumn($tableName, 'franchise_id')) {
                    $table->string('franchise_id', 100)->nullable();
                    $table->foreign('franchise_id')->references('id')->on('franchises')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['orders', 'products', 'addon_groups', 'addons', 'employees', 'drivers', 'system_settings', 'discount_applications'] as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (Schema::hasColumn($tableName, 'franchise_id')) {
                    $table->dropForeign(['franchise_id']);
                    $table->dropColumn('franchise_id');
                }
            });
        }
    }
};

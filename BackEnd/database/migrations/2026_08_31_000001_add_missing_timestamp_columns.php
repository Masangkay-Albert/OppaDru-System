<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['products', 'addon_groups', 'addons', 'product_addon_groups'];

        foreach ($tables as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $columns = Schema::getColumnListing($tableName);

                if (!in_array('created_at', $columns, true)) {
                    $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
                }

                if (!in_array('updated_at', $columns, true)) {
                    $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['products', 'addon_groups', 'addons', 'product_addon_groups'] as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $columns = Schema::getColumnListing($tableName);

                if (in_array('created_at', $columns, true)) {
                    $table->dropColumn('created_at');
                }

                if (in_array('updated_at', $columns, true)) {
                    $table->dropColumn('updated_at');
                }
            });
        }
    }
};
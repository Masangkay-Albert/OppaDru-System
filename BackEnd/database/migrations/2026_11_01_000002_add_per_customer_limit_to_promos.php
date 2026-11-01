<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('promos') && ! Schema::hasColumn('promos', 'per_customer_limit')) {
            Schema::table('promos', function (Blueprint $table) {
                $table->unsignedInteger('per_customer_limit')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('promos') && Schema::hasColumn('promos', 'per_customer_limit')) {
            Schema::table('promos', function (Blueprint $table) {
                $table->dropColumn('per_customer_limit');
            });
        }
    }
};

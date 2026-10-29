<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('promos') && !Schema::hasColumn('promos', 'channel')) {
            Schema::table('promos', function (Blueprint $table) {
                $table->string('channel', 16)->default('all');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('promos') && Schema::hasColumn('promos', 'channel')) {
            Schema::table('promos', function (Blueprint $table) {
                $table->dropColumn('channel');
            });
        }
    }
};

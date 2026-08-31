<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('addons', function (Blueprint $table) {
            if (!Schema::hasColumn('addons', 'image')) {
                $table->string('image')->nullable()->after('price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('addons', function (Blueprint $table) {
            if (Schema::hasColumn('addons', 'image')) {
                $table->dropColumn('image');
            }
        });
    }
};

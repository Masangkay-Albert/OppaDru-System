<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_users') && ! Schema::hasColumn('franchise_users', 'role')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                $table->string('role')->default('owner')->after('email');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_users') && Schema::hasColumn('franchise_users', 'role')) {
            Schema::table('franchise_users', fn (Blueprint $table) => $table->dropColumn('role'));
        }
    }
};

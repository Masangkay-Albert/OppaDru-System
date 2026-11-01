<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('admin', 'role')) {
            Schema::table('admin', function (Blueprint $table) {
                $table->string('role', 32)->default('admin');
            });
        }

        $systemAdmin = DB::table('admin')->where('email', 'admin@oppadru.com')->first();
        if ($systemAdmin) {
            DB::table('admin')->where('id', $systemAdmin->id)->update(['role' => 'system_administrator']);

            return;
        }

        DB::table('admin')->insert([
            'full_name' => 'System Administrator',
            'email' => 'admin@oppadru.com',
            'password' => Hash::make('Admin@123'),
            'api_token' => null,
            'role' => 'system_administrator',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('admin', 'role')) {
            Schema::table('admin', function (Blueprint $table) {
                $table->dropColumn('role');
            });
        }
    }
};

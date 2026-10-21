<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'include_cutlery')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->boolean('include_cutlery')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasColumn('orders', 'include_cutlery')) {
            return;
        }

        if (DB::table('orders')->where('include_cutlery', true)->exists()) {
            throw new RuntimeException('Cannot remove include_cutlery while orders contain true values.');
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('include_cutlery');
        });
    }
};

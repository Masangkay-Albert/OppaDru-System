<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'status_history')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->json('status_history')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'status_history')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('status_history');
            });
        }
    }
};

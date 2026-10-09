<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('system_settings') && Schema::hasColumn('system_settings', 'value')) {
            Schema::table('system_settings', function (Blueprint $table) {
                $table->text('value')->change();
            });
        }
    }

    public function down(): void
    {
        // Keep the expanded column to avoid truncating configured franchise program content.
    }
};

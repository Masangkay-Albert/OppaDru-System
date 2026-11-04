<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('franchises', function (Blueprint $table) {
            if (! Schema::hasColumn('franchises', 'type')) {
                $table->string('type')->default('franchise')->after('status');
            }
        });

        DB::table('franchises')->where('is_main', true)->update(['type' => 'company']);
        DB::table('franchises')->whereNull('type')->orWhere('type', '')->update(['type' => 'franchise']);
    }

    public function down(): void
    {
        Schema::table('franchises', function (Blueprint $table) {
            if (Schema::hasColumn('franchises', 'type')) {
                $table->dropColumn('type');
            }
        });
    }
};

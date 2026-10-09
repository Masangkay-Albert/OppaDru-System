<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('franchise_applications', 'reference_number')) {
                $table->string('reference_number')->nullable()->after('id')->unique();
            }
        });

        $rows = DB::table('franchise_applications')->whereNull('reference_number')->get();
        foreach ($rows as $row) {
            $reference = 'OPPA-' . date('Y') . '-' . strtoupper(str()->random(8));

            while (DB::table('franchise_applications')->where('reference_number', $reference)->exists()) {
                $reference = 'OPPA-' . date('Y') . '-' . strtoupper(str()->random(8));
            }

            DB::table('franchise_applications')->where('id', $row->id)->update(['reference_number' => $reference]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (Schema::hasColumn('franchise_applications', 'reference_number')) {
                $table->dropUnique(['reference_number']);
                $table->dropColumn('reference_number');
            }
        });
    }
};

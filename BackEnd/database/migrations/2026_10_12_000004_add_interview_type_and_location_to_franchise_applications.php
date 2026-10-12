<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('franchise_applications', 'interview_type')) {
                $table->string('interview_type', 20)->default('online');
            }
            if (! Schema::hasColumn('franchise_applications', 'interview_location')) {
                $table->string('interview_location', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        $columns = array_filter([
            Schema::hasColumn('franchise_applications', 'interview_type') ? 'interview_type' : null,
            Schema::hasColumn('franchise_applications', 'interview_location') ? 'interview_location' : null,
        ]);

        if ($columns !== []) {
            Schema::table('franchise_applications', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};

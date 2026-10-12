<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_applications')
            && ! Schema::hasColumn('franchise_applications', 'interview_meeting_url')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->string('interview_meeting_url', 2048)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications')
            && Schema::hasColumn('franchise_applications', 'interview_meeting_url')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropColumn('interview_meeting_url');
            });
        }
    }
};

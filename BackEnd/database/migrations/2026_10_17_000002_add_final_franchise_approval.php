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
            if (! Schema::hasColumn('franchise_applications', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'approved_by_admin_id')) {
                $table->unsignedBigInteger('approved_by_admin_id')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'approval_override_reason')) {
                $table->text('approval_override_reason')->nullable();
            }
        });

        DB::table('franchise_applications')
            ->where('status', 'conditionally_approved')
            ->update([
                'status' => 'for_final_evaluation',
                'next_step_instructions' => 'Your application is in its final evaluation. The franchise team will contact you with its decision.',
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        DB::table('franchise_applications')
            ->where('status', 'for_final_evaluation')
            ->update(['status' => 'conditionally_approved']);

        Schema::table('franchise_applications', function (Blueprint $table) {
            foreach (['approved_at', 'approved_by_admin_id', 'approval_override_reason'] as $column) {
                if (Schema::hasColumn('franchise_applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

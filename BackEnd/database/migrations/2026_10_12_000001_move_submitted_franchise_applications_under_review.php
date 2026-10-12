<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('franchise_applications')
            ->where('status', 'submitted')
            ->update([
                'status' => 'under_review',
                'next_step_instructions' => DB::raw(
                    "CASE
                        WHEN next_step_instructions IS NULL
                            OR next_step_instructions = 'Our franchise team will review your application and contact you using the contact email provided.'
                            OR next_step_instructions = 'Your application has been submitted and is waiting for review.'
                        THEN 'The franchise team is reviewing your experience, financial readiness, and proposed location.'
                        ELSE next_step_instructions
                    END",
                ),
            ]);
    }

    public function down(): void
    {
        // Existing applications should remain under review when rolling back code.
    }
};

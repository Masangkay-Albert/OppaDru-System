<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Security-question recovery was removed before this migration shipped.
    }

    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        foreach (['security_answer_hash', 'security_question'] as $column) {
            if (Schema::hasColumn('users', $column)) {
                Schema::table('users', fn ($table) => $table->dropColumn($column));
            }
        }
    }
};

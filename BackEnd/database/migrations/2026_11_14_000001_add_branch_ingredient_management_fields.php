<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branch_ingredient_stocks', function (Blueprint $table) {
            $table->boolean('is_archived')->default(false);
            $table->string('notes', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('branch_ingredient_stocks', function (Blueprint $table) {
            $table->dropColumn(['is_archived', 'notes']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('discount_applications')) {
            Schema::table('discount_applications', function (Blueprint $table) {
                $table->unique('user_id', 'discount_applications_user_id_unique');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('discount_applications')) {
            Schema::table('discount_applications', function (Blueprint $table) {
                $table->dropUnique('discount_applications_user_id_unique');
            });
        }
    }
};
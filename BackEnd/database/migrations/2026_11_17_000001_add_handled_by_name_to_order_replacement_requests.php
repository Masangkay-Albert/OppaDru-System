<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_replacement_requests', function (Blueprint $table) {
            $table->string('handled_by_name')->nullable();
        });
    }

    public function down(): void
    {
    }
};

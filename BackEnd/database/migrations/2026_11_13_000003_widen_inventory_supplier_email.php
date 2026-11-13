<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_suppliers', function (Blueprint $table) {
            $table->string('email', 254)->nullable()->change();
        });
    }

    public function down(): void
    {
    }
};

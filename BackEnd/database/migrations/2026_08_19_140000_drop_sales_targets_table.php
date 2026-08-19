<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('sales_targets');
    }

    public function down(): void
    {
        Schema::create('sales_targets', function ($table) {
            $table->id();
            $table->string('singleton_key')->default('default')->unique();
            $table->decimal('target_amount', 12, 2)->default(0);
            $table->timestamps();
        });
    }
};

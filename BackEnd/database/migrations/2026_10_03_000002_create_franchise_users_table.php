<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_users')) {
            return;
        }

        Schema::create('franchise_users', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('franchise_id', 100)->nullable();
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->string('api_token', 255)->nullable()->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('franchise_id')->references('id')->on('franchises')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('franchise_users');
    }
};

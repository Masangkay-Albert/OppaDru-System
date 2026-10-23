<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employees') && ! Schema::hasTable('employee_auth_sessions')) {
            Schema::create('employee_auth_sessions', function (Blueprint $table): void {
                $table->id();
                $table->string('employee_id', 100);
                $table->string('token_hash', 64)->unique();
                $table->timestamps();
                $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
                $table->index('employee_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_auth_sessions');
    }
};

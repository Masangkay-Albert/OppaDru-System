<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('discount_applications')) {
            Schema::create('discount_applications', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->unsignedBigInteger('user_id');
                $table->string('discount_type');
                $table->string('full_name');
                $table->string('id_number');
                $table->date('expiry_date')->nullable();
                $table->text('proof_image_url')->nullable();
                $table->string('status')->default('pending');
                $table->text('rejection_reason')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->string('reviewed_by_admin_id')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_applications');
    }
};

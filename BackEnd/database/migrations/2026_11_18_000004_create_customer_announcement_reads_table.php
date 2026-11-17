<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_announcement_reads', function (Blueprint $table) {
            $table->id();
            $table->string('announcement_id', 100);
            $table->string('user_id', 100);
            $table->timestamp('read_at');
            $table->timestamps();

            $table->unique(['user_id', 'announcement_id']);
            $table->foreign('announcement_id')->references('id')->on('announcements')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_announcement_reads');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcement_reads', function (Blueprint $table) {
            $table->id();
            $table->string('announcement_id', 100);
            $table->string('franchise_id', 100);
            $table->timestamp('viewed_at');
            $table->timestamps();

            $table->unique(['announcement_id', 'franchise_id']);
            $table->foreign('announcement_id')->references('id')->on('announcements')->cascadeOnDelete();
            $table->foreign('franchise_id')->references('id')->on('franchises')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_reads');
    }
};

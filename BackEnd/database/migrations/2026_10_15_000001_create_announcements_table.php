<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('announcements')) {
            return;
        }

        Schema::create('announcements', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('title');
            $table->text('content');
            $table->string('target_audience')->default('customers');
            $table->json('target_audiences')->nullable(); // array for multi-audience support
            $table->text('image_url')->nullable();
            $table->string('image_path')->nullable();
            $table->string('priority')->default('normal'); // 'normal', 'high', 'urgent', 'promo'
            $table->string('status')->default('published'); // 'published', 'scheduled', 'draft', 'archived'
            $table->timestamp('date_sent')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->string('author_name')->nullable();
            $table->string('author_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('target_audience');
            $table->index('status');
            $table->index('date_sent');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};

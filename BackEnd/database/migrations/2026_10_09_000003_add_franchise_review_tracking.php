<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_applications')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                if (! Schema::hasColumn('franchise_applications', 'interview_at')) {
                    $table->timestamp('interview_at')->nullable();
                }
                if (! Schema::hasColumn('franchise_applications', 'interview_notes')) {
                    $table->text('interview_notes')->nullable();
                }
                if (! Schema::hasColumn('franchise_applications', 'location_assessment')) {
                    $table->json('location_assessment')->nullable();
                }
            });
        }

        if (! Schema::hasTable('franchise_application_events')) {
            Schema::create('franchise_application_events', function (Blueprint $table) {
                $table->id();
                $table->string('application_id', 100);
                $table->string('actor_type', 20);
                $table->string('actor_id', 100)->nullable();
                $table->string('status')->nullable();
                $table->string('title');
                $table->text('message')->nullable();
                $table->boolean('is_internal')->default(false);
                $table->timestamp('created_at')->useCurrent();
                $table->foreign('application_id')
                    ->references('id')
                    ->on('franchise_applications')
                    ->cascadeOnDelete();
                $table->index(['application_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('franchise_application_events');

        if (Schema::hasTable('franchise_applications')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                foreach (['interview_at', 'interview_notes', 'location_assessment'] as $column) {
                    if (Schema::hasColumn('franchise_applications', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};

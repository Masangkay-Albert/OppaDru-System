<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'scheduled_at')) {
                $table->dateTime('scheduled_at')->nullable();
            }
            if (!Schema::hasColumn('orders', 'scheduled_date')) {
                $table->date('scheduled_date')->nullable();
            }
            if (!Schema::hasColumn('orders', 'scheduled_time')) {
                $table->string('scheduled_time')->nullable();
            }
            if (!Schema::hasColumn('orders', 'schedule_display')) {
                $table->string('schedule_display')->nullable();
            }
            if (!Schema::hasColumn('orders', 'schedule_window')) {
                $table->string('schedule_window')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('orders', 'scheduled_at') ? 'scheduled_at' : null,
                Schema::hasColumn('orders', 'scheduled_date') ? 'scheduled_date' : null,
                Schema::hasColumn('orders', 'scheduled_time') ? 'scheduled_time' : null,
                Schema::hasColumn('orders', 'schedule_display') ? 'schedule_display' : null,
                Schema::hasColumn('orders', 'schedule_window') ? 'schedule_window' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
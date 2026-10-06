<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'is_scheduled')) {
                $table->boolean('is_scheduled')->default(false);
            }
            if (!Schema::hasColumn('orders', 'scheduled_for')) {
                $table->dateTime('scheduled_for')->nullable();
            }
            if (!Schema::hasColumn('orders', 'fulfillment_type')) {
                $table->string('fulfillment_type', 20)->default('delivery');
            }
            if (!Schema::hasColumn('orders', 'special_instructions')) {
                $table->text('special_instructions')->nullable();
            }
            if (!Schema::hasColumn('orders', 'rescheduled_from')) {
                $table->dateTime('rescheduled_from')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        $columns = array_values(array_filter([
            Schema::hasColumn('orders', 'is_scheduled') ? 'is_scheduled' : null,
            Schema::hasColumn('orders', 'scheduled_for') ? 'scheduled_for' : null,
            Schema::hasColumn('orders', 'fulfillment_type') ? 'fulfillment_type' : null,
            Schema::hasColumn('orders', 'special_instructions') ? 'special_instructions' : null,
            Schema::hasColumn('orders', 'rescheduled_from') ? 'rescheduled_from' : null,
        ]));

        if ($columns !== []) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};

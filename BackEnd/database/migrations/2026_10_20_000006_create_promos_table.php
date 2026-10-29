<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('promos')) {
            Schema::create('promos', function (Blueprint $table) {
                $table->string('id', 50)->primary();
                $table->string('code', 50)->nullable()->unique();
                $table->string('title', 255);
                $table->text('description')->nullable();
                $table->string('channel', 16)->default('all');
                $table->enum('discount_type', ['percent', 'fixed'])->default('percent');
                $table->decimal('discount_value', 10, 2)->default(0);
                $table->dateTime('start_date')->nullable();
                $table->dateTime('end_date')->nullable();
                $table->boolean('is_active')->default(true);
                $table->string('image', 255)->nullable();
                $table->json('applicable_categories')->nullable();
                $table->json('applicable_products')->nullable();
                $table->decimal('min_order_amount', 10, 2)->default(0);
                $table->decimal('max_discount_amount', 10, 2)->nullable();
                $table->integer('usage_limit')->nullable();
                $table->integer('times_used')->default(0);
                $table->timestamps();

                $table->index(['is_active', 'start_date', 'end_date'], 'promos_active_dates_idx');
            });
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'promo_id')) {
                    $table->string('promo_id', 50)->nullable()->index();
                }
                if (!Schema::hasColumn('orders', 'promo_code')) {
                    $table->string('promo_code', 50)->nullable();
                }
                if (!Schema::hasColumn('orders', 'promo_discount')) {
                    $table->decimal('promo_discount', 10, 2)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'promo_id')) {
                    $table->dropColumn('promo_id');
                }
                if (Schema::hasColumn('orders', 'promo_code')) {
                    $table->dropColumn('promo_code');
                }
                if (Schema::hasColumn('orders', 'promo_discount')) {
                    $table->dropColumn('promo_discount');
                }
            });
        }

        Schema::dropIfExists('promos');
    }
};

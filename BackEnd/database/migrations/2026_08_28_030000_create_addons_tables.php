<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addon_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('selection_type')->default('multiple');
            $table->boolean('supports_quantity')->default(false);
            $table->unsignedInteger('max_selections')->nullable();
            $table->json('applicable_categories');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('addon_group_id')->constrained('addon_groups');
            $table->string('name');
            $table->decimal('price', 10, 2)->default(0);
            $table->text('image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_addon_groups', function (Blueprint $table) {
            $table->string('product_id', 100);
            $table->foreignId('addon_group_id')->constrained('addon_groups');
            $table->timestamps();
            $table->primary(['product_id', 'addon_group_id']);
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 100);
            $table->string('product_id', 100)->nullable();
            $table->text('product_name');
            $table->decimal('product_price', 10, 2);
            $table->unsignedInteger('quantity');
            $table->text('special_instructions')->nullable();
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('orders');
            $table->foreign('product_id')->references('id')->on('products');
            $table->index('order_id');
        });

        Schema::create('order_item_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items');
            $table->foreignId('addon_id')->nullable()->constrained('addons')->nullOnDelete();
            $table->text('addon_name');
            $table->decimal('unit_price', 10, 2);
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();
            $table->index('order_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_addons');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('product_addon_groups');
        Schema::dropIfExists('addons');
        Schema::dropIfExists('addon_groups');
    }
};
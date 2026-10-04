<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_inventory')) {
            return;
        }

        Schema::create('franchise_inventory', function (Blueprint $table) {
            $table->id();
            $table->string('franchise_id', 100);
            $table->string('product_id', 100);
            $table->unsignedInteger('stock_quantity')->nullable();
            $table->boolean('is_available')->default(true);
            $table->timestamps();

            $table->foreign('franchise_id')->references('id')->on('franchises')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->unique(['franchise_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('franchise_inventory');
    }
};

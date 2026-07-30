<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('email');
            $table->string('order_number')->unique();
            $table->decimal('total', 10, 2);
            $table->string('status')->default('pending');
            $table->string('payment_method');
            $table->text('delivery_address');
            $table->string('phone');
            $table->json('items');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_replacement_requests', function (Blueprint $table) {
            $table->id();
            $table->string('order_id');
            $table->string('user_id')->nullable();
            $table->string('branch_id')->nullable();
            $table->string('franchise_id')->nullable();
            $table->string('franchise_account_id')->nullable();
            $table->string('issue_type', 40);
            $table->json('affected_items');
            $table->string('description', 255);
            $table->json('photo_paths')->nullable();
            $table->string('status', 30)->default('pending');
            $table->string('reject_reason', 200)->nullable();
            $table->string('handled_by')->nullable();
            $table->timestamp('handled_at')->nullable();
            $table->string('replacement_order_id')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('replacement_of_order_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['replacement_of_order_id']);
            $table->dropColumn('replacement_of_order_id');
        });

        Schema::dropIfExists('order_replacement_requests');
    }
};

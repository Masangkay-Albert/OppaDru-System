<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('branch_id', 100)->nullable()->after('ingredient_id');
            $table->foreign('branch_id')->references('id')->on('franchises')->nullOnDelete();
            $table->index(['branch_id', 'ingredient_id', 'created_at'], 'stock_movements_branch_ingredient_date_idx');
        });

        Schema::create('branch_ingredient_stocks', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id', 100);
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->decimal('quantity', 12, 3)->default(0);
            $table->decimal('reorder_level', 12, 3)->default(0);
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->timestamps();
            $table->foreign('branch_id')->references('id')->on('franchises')->cascadeOnDelete();
            $table->unique(['branch_id', 'ingredient_id']);
        });

        Schema::create('branch_order_ingredient_deductions', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 100);
            $table->string('branch_id', 100);
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->foreignId('movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->foreignId('reversal_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->boolean('is_reversed')->default(false);
            $table->timestamps();
            $table->foreign('branch_id')->references('id')->on('franchises')->cascadeOnDelete();
            $table->unique(['order_id', 'branch_id', 'ingredient_id'], 'branch_order_ingredient_deduction_unique');
        });

        Schema::create('inventory_restock_requests', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id', 100);
            $table->string('status', 30)->default('pending');
            $table->string('requested_by', 120)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('admin')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->foreign('branch_id')->references('id')->on('franchises')->cascadeOnDelete();
            $table->index(['branch_id', 'status', 'created_at']);
        });

        Schema::create('inventory_restock_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('inventory_restock_requests')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->decimal('requested_quantity', 12, 3);
            $table->decimal('approved_quantity', 12, 3)->nullable();
            $table->timestamps();
            $table->unique(['request_id', 'ingredient_id']);
        });

        Schema::create('inventory_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('source_branch_id', 100);
            $table->string('destination_branch_id', 100);
            $table->foreignId('request_id')->nullable()->constrained('inventory_restock_requests')->nullOnDelete();
            $table->string('reference', 100)->unique();
            $table->string('status', 30)->default('dispatched');
            $table->text('notes')->nullable();
            $table->foreignId('dispatched_by')->nullable()->constrained('admin')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->foreign('source_branch_id')->references('id')->on('franchises')->restrictOnDelete();
            $table->foreign('destination_branch_id')->references('id')->on('franchises')->restrictOnDelete();
            $table->index(['destination_branch_id', 'status', 'created_at']);
        });

        Schema::create('inventory_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_id')->constrained('inventory_transfers')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->foreignId('source_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->json('batch_lots')->nullable();
            $table->timestamps();
            $table->unique(['transfer_id', 'ingredient_id']);
        });

        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id', 100)->nullable();
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->foreignId('movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->decimal('quantity_received', 12, 3);
            $table->decimal('quantity_remaining', 12, 3);
            $table->timestamp('received_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamps();
            $table->foreign('branch_id')->references('id')->on('franchises')->cascadeOnDelete();
            $table->index(['branch_id', 'ingredient_id', 'expires_at'], 'stock_batches_fefo_idx');
        });

        Schema::create('stock_batch_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movement_id')->constrained('stock_movements')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->constrained('stock_batches')->restrictOnDelete();
            $table->decimal('quantity_change', 12, 3);
            $table->timestamps();
            $table->index(['stock_batch_id', 'movement_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_batch_movements');
        Schema::dropIfExists('stock_batches');
        Schema::dropIfExists('inventory_transfer_items');
        Schema::dropIfExists('inventory_transfers');
        Schema::dropIfExists('inventory_restock_request_items');
        Schema::dropIfExists('inventory_restock_requests');
        Schema::dropIfExists('branch_order_ingredient_deductions');
        Schema::dropIfExists('branch_ingredient_stocks');
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropIndex('stock_movements_branch_ingredient_date_idx');
            $table->dropColumn('branch_id');
        });
    }
};

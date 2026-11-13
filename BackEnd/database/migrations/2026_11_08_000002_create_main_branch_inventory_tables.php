<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('main_branch_ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->string('category', 100);
            $table->string('unit', 20);
            $table->decimal('quantity', 12, 3)->default(0);
            $table->decimal('reorder_level', 12, 3)->default(0);
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->string('supplier', 180)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_archived')->default(false);
            $table->timestamps();

            $table->index(['is_archived', 'category']);
            $table->index(['is_archived', 'name']);
        });

        Schema::create('main_branch_stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id')
                ->nullable()
                ->constrained('main_branch_ingredients')
                ->nullOnDelete();
            $table->string('ingredient_name', 160);
            $table->string('unit', 20);
            $table->string('type', 30);
            $table->decimal('quantity_change', 12, 3);
            $table->decimal('quantity_before', 12, 3);
            $table->decimal('quantity_after', 12, 3);
            $table->text('reason')->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('admin')->nullOnDelete();
            $table->string('performed_by', 160);
            $table->timestamps();

            $table->index(['ingredient_id', 'created_at']);
            $table->index(['type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('main_branch_stock_movements');
        Schema::dropIfExists('main_branch_ingredients');
    }
};

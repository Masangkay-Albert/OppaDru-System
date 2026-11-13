<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 180)->unique();
            $table->string('contact_person', 160)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('email', 180)->nullable();
            $table->unsignedSmallInteger('lead_time_days')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('main_branch_ingredients', function (Blueprint $table) {
            $table->decimal('quantity', 12, 3)->default(0)->change();
            $table->decimal('reorder_level', 12, 3)->default(0)->change();
            $table->foreignId('supplier_id')->nullable()->after('supplier')
                ->constrained('inventory_suppliers')->nullOnDelete();
            $table->string('purchase_unit', 20)->nullable()->after('unit');
            $table->decimal('conversion_factor', 12, 6)->default(1)->after('purchase_unit');
        });

        Schema::table('franchise_inventory', function (Blueprint $table) {
            $table->boolean('ingredient_unavailable')->default(false);
        });

        $supplierNames = DB::table('main_branch_ingredients')
            ->whereNotNull('supplier')
            ->whereRaw("TRIM(supplier) <> ''")
            ->select('supplier')
            ->distinct()
            ->pluck('supplier');

        foreach ($supplierNames as $supplierName) {
            $supplierId = DB::table('inventory_suppliers')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($supplierName))])
                ->value('id');

            if ($supplierId === null) {
                $supplierId = DB::table('inventory_suppliers')->insertGetId([
                    'name' => trim($supplierName),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('main_branch_ingredients')
                ->whereRaw('LOWER(TRIM(supplier)) = ?', [mb_strtolower(trim($supplierName))])
                ->update(['supplier_id' => $supplierId]);
        }

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id')->nullable()
                ->constrained('main_branch_ingredients')->nullOnDelete();
            $table->string('ingredient_name', 160);
            $table->string('unit', 20);
            $table->string('type', 30);
            $table->decimal('quantity', 12, 3);
            $table->decimal('quantity_change', 12, 3);
            $table->decimal('quantity_before', 12, 3);
            $table->decimal('quantity_after', 12, 3);
            $table->decimal('unit_cost', 12, 4)->nullable();
            $table->text('reason')->nullable();
            $table->string('order_id', 100)->nullable();
            $table->foreignId('supplier_id')->nullable()
                ->constrained('inventory_suppliers')->nullOnDelete();
            $table->decimal('purchase_quantity', 12, 3)->nullable();
            $table->string('purchase_unit', 20)->nullable();
            $table->string('invoice_reference', 160)->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('admin')->nullOnDelete();
            $table->string('user_id', 100)->nullable();
            $table->string('actor_type', 80)->nullable();
            $table->string('actor_id', 100)->nullable();
            $table->string('performed_by', 160);
            $table->timestamps();
            $table->index(['ingredient_id', 'created_at']);
            $table->index(['type', 'created_at']);
            $table->index(['order_id', 'type']);
        });

        DB::table('main_branch_stock_movements')->orderBy('id')->each(function ($movement) {
            DB::table('stock_movements')->insert([
                'ingredient_id' => $movement->ingredient_id,
                'ingredient_name' => $movement->ingredient_name,
                'unit' => $movement->unit,
                'type' => $movement->type === 'correction' ? 'adjustment' : $movement->type,
                'quantity' => abs((float) $movement->quantity_change),
                'quantity_change' => $movement->quantity_change,
                'quantity_before' => $movement->quantity_before,
                'quantity_after' => $movement->quantity_after,
                'unit_cost' => null,
                'reason' => $movement->reason,
                'admin_id' => $movement->admin_id,
                'actor_type' => $movement->admin_id === null ? null : 'admin',
                'actor_id' => $movement->admin_id,
                'performed_by' => $movement->performed_by,
                'occurred_at' => $movement->created_at,
                'created_at' => $movement->created_at,
                'updated_at' => $movement->updated_at,
            ]);
        });

        Schema::create('ingredient_recipes', function (Blueprint $table) {
            $table->id();
            $table->string('product_id', 100);
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->cascadeOnDelete();
            $table->decimal('quantity', 12, 6);
            $table->string('unit', 20);
            $table->timestamps();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->unique(['product_id', 'ingredient_id']);
        });

        Schema::create('order_ingredient_deductions', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 100);
            $table->foreignId('ingredient_id')->constrained('main_branch_ingredients')->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->foreignId('movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->foreignId('reversal_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->boolean('is_reversed')->default(false);
            $table->timestamps();
            $table->unique(['order_id', 'ingredient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_ingredient_deductions');
        Schema::dropIfExists('ingredient_recipes');
        Schema::dropIfExists('stock_movements');
        Schema::table('main_branch_ingredients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn(['purchase_unit', 'conversion_factor']);
            $table->decimal('quantity', 12, 3)->default(0)->change();
            $table->decimal('reorder_level', 12, 3)->default(0)->change();
        });
        Schema::table('franchise_inventory', function (Blueprint $table) {
            $table->dropColumn('ingredient_unavailable');
        });
        Schema::dropIfExists('inventory_suppliers');
    }
};

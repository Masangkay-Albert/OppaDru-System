<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_inventory')) {
            return;
        }

        Schema::table('franchise_inventory', function (Blueprint $table): void {
            if (! Schema::hasColumn('franchise_inventory', 'branch_name')) {
                $table->string('branch_name')->nullable();
            }
            if (! Schema::hasColumn('franchise_inventory', 'branch_description')) {
                $table->text('branch_description')->nullable();
            }
            if (! Schema::hasColumn('franchise_inventory', 'branch_price')) {
                $table->decimal('branch_price', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('franchise_inventory', 'branch_category')) {
                $table->string('branch_category')->nullable();
            }
            if (! Schema::hasColumn('franchise_inventory', 'branch_image')) {
                $table->text('branch_image')->nullable();
            }
            if (! Schema::hasColumn('franchise_inventory', 'is_archived')) {
                $table->boolean('is_archived')->default(false);
            }
            if (! Schema::hasColumn('franchise_inventory', 'is_hidden')) {
                $table->boolean('is_hidden')->default(false);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_inventory')) {
            return;
        }

        Schema::table('franchise_inventory', function (Blueprint $table): void {
            $columns = [
                'branch_name',
                'branch_description',
                'branch_price',
                'branch_category',
                'branch_image',
                'is_archived',
                'is_hidden',
            ];
            foreach ($columns as $column) {
                if (Schema::hasColumn('franchise_inventory', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

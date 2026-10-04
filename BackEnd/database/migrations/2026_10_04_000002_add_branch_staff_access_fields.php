<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                if (!Schema::hasColumn('employees', 'api_token')) {
                    $table->string('api_token', 64)->nullable()->unique();
                }
                if (!Schema::hasColumn('employees', 'is_active')) {
                    $table->boolean('is_active')->default(true);
                }
            });
        }

        if (Schema::hasTable('drivers')) {
            Schema::table('drivers', function (Blueprint $table) {
                if (!Schema::hasColumn('drivers', 'api_token')) {
                    $table->string('api_token', 64)->nullable()->unique();
                }
            });
        }

        if (Schema::hasTable('franchise_users')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                if (!Schema::hasColumn('franchise_users', 'can_process_pos')) {
                    $table->boolean('can_process_pos')->default(false);
                }
            });
        }

        if (Schema::hasTable('orders') && Schema::hasTable('employees')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'cashier_employee_id')) {
                    $table->string('cashier_employee_id', 100)->nullable()->index();
                }
            });
        }
    }

    public function down(): void
    {
        // Retain added access and order-attribution data if a deployment is rolled back.
    }
};

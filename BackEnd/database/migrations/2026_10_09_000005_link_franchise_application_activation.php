<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('franchise_applications', 'franchise_account_id')) {
                $table->string('franchise_account_id', 100)->nullable()->index();
            }
            if (! Schema::hasColumn('franchise_applications', 'franchise_id')) {
                $table->string('franchise_id', 100)->nullable()->index();
            }
            if (! Schema::hasColumn('franchise_applications', 'activated_at')) {
                $table->timestamp('activated_at')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'activated_by_admin_id')) {
                $table->unsignedBigInteger('activated_by_admin_id')->nullable();
            }
        });

        if (Schema::hasTable('franchise_accounts')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->foreign('franchise_account_id')
                    ->references('id')
                    ->on('franchise_accounts')
                    ->nullOnDelete();
            });
        }
        if (Schema::hasTable('franchises')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->foreign('franchise_id')
                    ->references('id')
                    ->on('franchises')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            if (Schema::hasColumn('franchise_applications', 'franchise_account_id')) {
                $table->dropForeign(['franchise_account_id']);
            }
            if (Schema::hasColumn('franchise_applications', 'franchise_id')) {
                $table->dropForeign(['franchise_id']);
            }
        });

        Schema::table('franchise_applications', function (Blueprint $table) {
            foreach (['franchise_account_id', 'franchise_id', 'activated_at', 'activated_by_admin_id'] as $column) {
                if (Schema::hasColumn('franchise_applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

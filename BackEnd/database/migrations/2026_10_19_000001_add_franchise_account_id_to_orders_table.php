<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'franchise_account_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('franchise_account_id', 100)->nullable()->index();
            });
        }

        if (Schema::hasColumn('orders', 'franchise_id') && Schema::hasTable('franchises')) {
            DB::table('orders')
                ->whereNull('franchise_account_id')
                ->whereNotNull('franchise_id')
                ->update([
                    'franchise_account_id' => DB::raw(
                        '(SELECT franchises.franchise_account_id FROM franchises WHERE franchises.id = orders.franchise_id)'
                    ),
                ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'franchise_account_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropIndex(['franchise_account_id']);
                $table->dropColumn('franchise_account_id');
            });
        }
    }
};

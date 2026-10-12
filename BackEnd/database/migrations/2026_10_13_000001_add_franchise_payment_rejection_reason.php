<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_applications')
            && ! Schema::hasColumn('franchise_applications', 'franchise_fee_payment_reject_reason')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->text('franchise_fee_payment_reject_reason')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications')
            && Schema::hasColumn('franchise_applications', 'franchise_fee_payment_reject_reason')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropColumn('franchise_fee_payment_reject_reason');
            });
        }
    }
};

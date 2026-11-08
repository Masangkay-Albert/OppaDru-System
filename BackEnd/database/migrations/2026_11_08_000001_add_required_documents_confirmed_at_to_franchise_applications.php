<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_applications')
            || Schema::hasColumn('franchise_applications', 'required_documents_confirmed_at')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            $table->timestamp('required_documents_confirmed_at')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications')
            && Schema::hasColumn('franchise_applications', 'required_documents_confirmed_at')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropColumn('required_documents_confirmed_at');
            });
        }
    }
};

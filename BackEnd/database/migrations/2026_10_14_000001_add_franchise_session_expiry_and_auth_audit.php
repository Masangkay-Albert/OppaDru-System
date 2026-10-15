<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('franchise_users') && ! Schema::hasColumn('franchise_users', 'api_token_expires_at')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                $table->timestamp('api_token_expires_at')->nullable();
            });
        }

        if (! Schema::hasTable('franchise_auth_events')) {
            Schema::create('franchise_auth_events', function (Blueprint $table) {
                $table->id();
                $table->string('franchise_applicant_id', 100)->nullable()->index();
                $table->string('franchise_user_id', 100)->nullable()->index();
                $table->char('email_fingerprint', 64);
                $table->string('outcome', 20);
                $table->string('reason', 50);
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 500)->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('franchise_applicant_id')
                    ->references('id')
                    ->on('franchise_applicants')
                    ->nullOnDelete();
                $table->foreign('franchise_user_id')
                    ->references('id')
                    ->on('franchise_users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('franchise_auth_events');

        if (Schema::hasTable('franchise_users') && Schema::hasColumn('franchise_users', 'api_token_expires_at')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                $table->dropColumn('api_token_expires_at');
            });
        }
    }
};

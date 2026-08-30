<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index('user_id', 'orders_user_id_index');
            $table->index('email', 'orders_email_index');
            $table->index('created_at', 'orders_created_at_index');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index('created_at', 'users_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_user_id_index');
            $table->dropIndex('orders_email_index');
            $table->dropIndex('orders_created_at_index');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_created_at_index');
        });
    }
};
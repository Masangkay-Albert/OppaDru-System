<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('franchise_accounts')) {
            Schema::create('franchise_accounts', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->text('address')->nullable();
                $table->string('status')->default('active');
                $table->unsignedBigInteger('owner_admin_id')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('franchises') && ! Schema::hasColumn('franchises', 'franchise_account_id')) {
            Schema::table('franchises', function (Blueprint $table) {
                $table->string('franchise_account_id', 100)->nullable()->index();
                $table->foreign('franchise_account_id')
                    ->references('id')
                    ->on('franchise_accounts')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('franchise_users') && ! Schema::hasColumn('franchise_users', 'franchise_account_id')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                $table->string('franchise_account_id', 100)->nullable()->index();
                $table->foreign('franchise_account_id')
                    ->references('id')
                    ->on('franchise_accounts')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasTable('franchises') || ! Schema::hasColumn('franchises', 'franchise_account_id')) {
            return;
        }

        foreach (DB::table('franchises')->whereNull('franchise_account_id')->orderBy('id')->get() as $location) {
            $slug = 'legacy-'.Str::slug($location->slug ?: $location->name ?: $location->id);
            $accountId = 'OPPA-FA-'.strtoupper(Str::random(8));
            $now = now();

            DB::table('franchise_accounts')->insert([
                'id' => $accountId,
                'name' => $location->name,
                'slug' => $slug,
                'email' => $location->email,
                'phone' => $location->phone,
                'address' => $location->address,
                'status' => $location->status ?: 'active',
                'owner_admin_id' => $location->owner_admin_id,
                'metadata' => $location->metadata,
                'created_at' => $location->created_at ?: $now,
                'updated_at' => $location->updated_at ?: $now,
            ]);

            DB::table('franchises')
                ->where('id', $location->id)
                ->update(['franchise_account_id' => $accountId]);

            if (Schema::hasTable('franchise_users') && Schema::hasColumn('franchise_users', 'franchise_account_id')) {
                DB::table('franchise_users')
                    ->where('franchise_id', $location->id)
                    ->whereNull('franchise_account_id')
                    ->update(['franchise_account_id' => $accountId]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_users') && Schema::hasColumn('franchise_users', 'franchise_account_id')) {
            Schema::table('franchise_users', function (Blueprint $table) {
                $table->dropForeign(['franchise_account_id']);
                $table->dropColumn('franchise_account_id');
            });
        }

        if (Schema::hasTable('franchises') && Schema::hasColumn('franchises', 'franchise_account_id')) {
            Schema::table('franchises', function (Blueprint $table) {
                $table->dropForeign(['franchise_account_id']);
                $table->dropColumn('franchise_account_id');
            });
        }

        Schema::dropIfExists('franchise_accounts');
    }
};

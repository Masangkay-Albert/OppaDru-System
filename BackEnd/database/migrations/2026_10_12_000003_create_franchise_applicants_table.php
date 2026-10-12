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
        if (! Schema::hasTable('franchise_applicants')) {
            Schema::create('franchise_applicants', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->string('full_name');
                $table->string('email')->unique();
                $table->string('phone', 50)->nullable();
                $table->string('password');
                $table->string('api_token', 64)->nullable()->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('franchise_applications')
            && ! Schema::hasColumn('franchise_applications', 'franchise_applicant_id')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->string('franchise_applicant_id', 100)->nullable();
                $table->foreign('franchise_applicant_id')
                    ->references('id')
                    ->on('franchise_applicants')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasTable('users') || ! Schema::hasTable('franchise_applications')) {
            return;
        }

        $legacyUsers = DB::table('users')
            ->join('franchise_applications', 'franchise_applications.user_id', '=', 'users.id')
            ->select('users.id', 'users.full_name', 'users.email', 'users.phone', 'users.password', 'users.email_verified_at')
            ->distinct()
            ->get();

        foreach ($legacyUsers as $user) {
            $email = strtolower(trim($user->email));
            $applicantId = DB::table('franchise_applicants')
                ->whereRaw('LOWER(email) = ?', [$email])
                ->value('id');

            if (! $applicantId) {
                $applicantId = 'OPPA-FRA-'.strtoupper(Str::random(12));
                DB::table('franchise_applicants')->insert([
                    'id' => $applicantId,
                    'full_name' => $user->full_name,
                    'email' => $email,
                    'phone' => $user->phone,
                    'password' => $user->password,
                    'email_verified_at' => $user->email_verified_at,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('franchise_applications')
                ->where('user_id', $user->id)
                ->whereNull('franchise_applicant_id')
                ->update(['franchise_applicant_id' => $applicantId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('franchise_applications')
            && Schema::hasColumn('franchise_applications', 'franchise_applicant_id')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropForeign(['franchise_applicant_id']);
                $table->dropColumn('franchise_applicant_id');
            });
        }

        Schema::dropIfExists('franchise_applicants');
    }
};

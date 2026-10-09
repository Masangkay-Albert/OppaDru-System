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
            if (! Schema::hasColumn('franchise_applications', 'user_id')) {
                $table->string('user_id', 100)->nullable()->index();
            }
            if (! Schema::hasColumn('franchise_applications', 'applicant_address')) {
                $table->text('applicant_address')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'business_experience')) {
                $table->text('business_experience')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'investment_capacity')) {
                $table->decimal('investment_capacity', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'has_proposed_property')) {
                $table->boolean('has_proposed_property')->default(false);
            }
            if (! Schema::hasColumn('franchise_applications', 'opening_timeline')) {
                $table->string('opening_timeline')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'business_information')) {
                $table->text('business_information')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'documents')) {
                $table->json('documents')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'next_step_instructions')) {
                $table->text('next_step_instructions')->nullable();
            }
        });

        if (Schema::hasTable('users') && Schema::hasColumn('franchise_applications', 'user_id')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        if (Schema::hasColumn('franchise_applications', 'user_id')) {
            Schema::table('franchise_applications', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            foreach ([
                'user_id',
                'applicant_address',
                'business_experience',
                'investment_capacity',
                'has_proposed_property',
                'opening_timeline',
                'business_information',
                'documents',
                'next_step_instructions',
            ] as $column) {
                if (Schema::hasColumn('franchise_applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

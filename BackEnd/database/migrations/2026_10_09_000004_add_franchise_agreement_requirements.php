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
            if (! Schema::hasColumn('franchise_applications', 'agreement_status')) {
                $table->string('agreement_status')->default('not_started');
            }
            if (! Schema::hasColumn('franchise_applications', 'agreement_prepared_at')) {
                $table->timestamp('agreement_prepared_at')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'agreement_signed_at')) {
                $table->timestamp('agreement_signed_at')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'franchise_fee_amount')) {
                $table->decimal('franchise_fee_amount', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'franchise_fee_payment_status')) {
                $table->string('franchise_fee_payment_status')->default('not_configured');
            }
            if (! Schema::hasColumn('franchise_applications', 'franchise_fee_payment_reference')) {
                $table->string('franchise_fee_payment_reference')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'required_documents')) {
                $table->json('required_documents')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'requirements_reviewed_at')) {
                $table->timestamp('requirements_reviewed_at')->nullable();
            }
            if (! Schema::hasColumn('franchise_applications', 'location_readiness')) {
                $table->string('location_readiness')->default('pending');
            }
            if (! Schema::hasColumn('franchise_applications', 'permit_compliance_status')) {
                $table->string('permit_compliance_status')->default('pending');
            }
            if (! Schema::hasColumn('franchise_applications', 'training_status')) {
                $table->string('training_status')->default('pending');
            }
            if (! Schema::hasColumn('franchise_applications', 'operational_preparation_status')) {
                $table->string('operational_preparation_status')->default('pending');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('franchise_applications')) {
            return;
        }

        Schema::table('franchise_applications', function (Blueprint $table) {
            foreach ([
                'agreement_status',
                'agreement_prepared_at',
                'agreement_signed_at',
                'franchise_fee_amount',
                'franchise_fee_payment_status',
                'franchise_fee_payment_reference',
                'required_documents',
                'requirements_reviewed_at',
                'location_readiness',
                'permit_compliance_status',
                'training_status',
                'operational_preparation_status',
            ] as $column) {
                if (Schema::hasColumn('franchise_applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'discount_type')) {
                $table->string('discount_type')->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_rate')) {
                $table->decimal('discount_rate', 10, 4)->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_status')) {
                $table->string('discount_status')->default('not_requested');
            }
            if (!Schema::hasColumn('orders', 'discount_proof_image')) {
                $table->text('discount_proof_image')->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_rejection_reason')) {
                $table->text('discount_rejection_reason')->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_requested_at')) {
                $table->timestamp('discount_requested_at')->nullable();
            }
            if (!Schema::hasColumn('orders', 'discount_reviewed_at')) {
                $table->timestamp('discount_reviewed_at')->nullable();
            }
        });

        if (!Schema::hasTable('discount_verification_requests')) {
            Schema::create('discount_verification_requests', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->string('order_id', 100)->index();
                $table->string('discount_type');
                $table->decimal('discount_rate', 10, 4)->default(0.20);
                $table->decimal('discount_amount', 10, 2)->default(0);
                $table->text('proof_image_url')->nullable();
                $table->string('status')->default('pending');
                $table->text('rejection_reason')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->string('reviewed_by_admin_id')->nullable();
                $table->decimal('order_total_at_submission', 10, 2)->default(0);
                $table->timestamps();

                $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('discount_verification_requests')) {
            Schema::dropIfExists('discount_verification_requests');
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                $columns = ['discount_type', 'discount_rate', 'discount_amount', 'discount_status', 'discount_proof_image', 'discount_rejection_reason', 'discount_requested_at', 'discount_reviewed_at'];
                foreach ($columns as $column) {
                    if (Schema::hasColumn('orders', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};

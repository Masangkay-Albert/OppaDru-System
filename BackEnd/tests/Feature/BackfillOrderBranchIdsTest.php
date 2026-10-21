<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackfillOrderBranchIdsTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfills_only_null_branch_ids_from_existing_valid_franchise_ids(): void
    {
        $branch = Franchise::create([
            'name' => 'Backfill Branch',
            'status' => 'active',
        ]);
        $order = Order::create([
            'franchise_id' => $branch->id,
            'branch_id' => null,
            'email' => 'backfill@example.com',
            'order_number' => 'BACKFILL-ORDER-1',
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test address',
            'phone' => '09170000000',
            'items' => [],
        ]);

        $this->artisan('orders:backfill-branch-id')
            ->expectsOutput('Orders eligible for backfill: 1')
            ->expectsOutput('Orders backfilled: 1')
            ->assertSuccessful();

        $this->assertSame($branch->id, $order->fresh()->branch_id);
    }

    public function test_dry_run_reports_eligible_orders_without_changing_them(): void
    {
        $branch = Franchise::create([
            'name' => 'Dry Run Branch',
            'status' => 'active',
        ]);
        $order = Order::create([
            'franchise_id' => $branch->id,
            'branch_id' => null,
            'email' => 'dry-run@example.com',
            'order_number' => 'BACKFILL-ORDER-2',
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test address',
            'phone' => '09170000000',
            'items' => [],
        ]);

        $this->artisan('orders:backfill-branch-id', ['--dry-run' => true])
            ->expectsOutput('Orders eligible for backfill: 1')
            ->expectsOutput('Dry run: no order rows were changed.')
            ->assertSuccessful();

        $this->assertNull($order->fresh()->branch_id);
    }
}

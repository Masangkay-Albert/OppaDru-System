<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Driver;
use App\Models\Franchise;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KitchenOrderChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_kitchen_order_list_includes_the_order_branch_name(): void
    {
        $branch = Franchise::create([
            'name' => 'Kitchen Branch',
            'status' => 'active',
        ]);
        [$headers] = $this->createKitchenStaff($branch->id);
        $order = $this->createOrder('KITCHEN-BRANCH-TEST', 'standard', 'Customer delivery address');
        $order->update([
            'branch_id' => $branch->id,
            'franchise_id' => $branch->id,
        ]);

        $this->getJson('/api/kitchen/orders?tab=pending', $headers)
            ->assertOk()
            ->assertJsonPath('0.branch_name', 'Kitchen Branch');
    }

    public function test_main_system_kitchen_sees_orders_assigned_to_the_main_branch_id(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'is_main' => true,
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Branch',
            'status' => 'active',
        ]);
        [$headers] = $this->createKitchenStaff();
        $mainBranchOrder = $this->createOrder('MAIN-BRANCH-KITCHEN-TEST', 'standard', 'Customer delivery address');
        $mainBranchOrder->update(['branch_id' => $mainBranch->id]);
        $otherBranchOrder = $this->createOrder('OTHER-BRANCH-KITCHEN-TEST', 'standard', 'Customer delivery address');
        $otherBranchOrder->update([
            'branch_id' => $otherBranch->id,
            'franchise_id' => $otherBranch->id,
        ]);

        $this->getJson('/api/kitchen/orders?tab=pending', $headers)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $mainBranchOrder->id)
            ->assertJsonPath('0.branch_name', 'Cavite Branch');
        $this->getJson('/api/kitchen/orders/counts', $headers)
            ->assertOk()
            ->assertJsonPath('new_count', 1);
        $this->patchJson('/api/kitchen/orders/'.$mainBranchOrder->id.'/status', [
            'status' => 'preparing',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');
    }

    public function test_prepared_walk_in_orders_become_delivered_without_changing_online_orders(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'is_main' => true,
        ]);
        $kitchenStaff = Employee::create([
            'franchise_id' => $mainBranch->id,
            'fullName' => 'Main Kitchen',
            'email' => 'kitchen@example.com',
            'password' => Hash::make('Kitchen@123'),
            'position' => 'kitchen staff',
        ]);
        $token = 'main-kitchen-token';
        $kitchenStaff->api_token = hash('sha256', $token);
        $kitchenStaff->save();
        $headers = ['Authorization' => 'Bearer '.$token];

        $onsiteOrder = $this->createOrder('ONSITE-CHANNEL-TEST', 'onsite', 'Onsite - Takeout (Customer: Walk-in Customer)');
        $onlineOrder = $this->createOrder('ONLINE-CHANNEL-TEST', 'standard', 'Customer delivery address');

        $this->patchJson('/api/kitchen/orders/'.$onsiteOrder->id.'/status', ['status' => 'prepared'], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'delivered');

        $this->patchJson('/api/kitchen/orders/'.$onlineOrder->id.'/status', ['status' => 'prepared'], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'prepared');

        $this->getJson('/api/orders')->assertUnauthorized();
    }

    public function test_prepared_delivery_is_available_to_main_system_driver_and_acceptance_moves_it_to_active(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'is_main' => true,
        ]);
        [$kitchenHeaders] = $this->createKitchenStaff();
        $order = $this->createOrder('OPPA-ORD-20261021-Y27WTJNH', 'standard', 'Mahubay City delivery address');
        $order->update([
            'branch_id' => $mainBranch->id,
            'franchise_id' => $mainBranch->id,
            'fulfillment_type' => 'delivery',
        ]);
        $driver = Driver::create([
            'name' => 'Main System Driver',
            'email' => 'main-driver@example.test',
            'password' => Hash::make('Driver@123'),
            'phone' => '09170000001',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
        $driverToken = 'main-driver-token';
        $driver->api_token = hash('sha256', $driverToken);
        $driver->save();
        $driverHeaders = ['Authorization' => 'Bearer '.$driverToken];
        $otherDriver = Driver::create([
            'name' => 'Second Main System Driver',
            'email' => 'second-main-driver@example.test',
            'password' => Hash::make('Driver@123'),
            'phone' => '09170000002',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
        $otherDriverToken = 'second-main-driver-token';
        $otherDriver->api_token = hash('sha256', $otherDriverToken);
        $otherDriver->save();

        $this->patchJson('/api/kitchen/orders/'.$order->id.'/status', [
            'status' => 'prepared',
        ], $kitchenHeaders)
            ->assertOk()
            ->assertJsonPath('order.status', 'prepared');

        $this->getJson('/api/driver/orders?tab=available', $driverHeaders)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $order->id)
            ->assertJsonPath('0.status', 'prepared');

        $this->patchJson('/api/driver/orders/'.$order->id.'/status', [
            'status' => 'on_the_way',
        ], $driverHeaders)
            ->assertOk()
            ->assertJsonPath('order.status', 'on_the_way')
            ->assertJsonPath('order.driver_id', $driver->id);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'on_the_way',
            'driver_id' => $driver->id,
        ]);
        $this->patchJson('/api/driver/orders/'.$order->id.'/status', [
            'status' => 'on_the_way',
        ], ['Authorization' => 'Bearer '.$otherDriverToken])
            ->assertStatus(409);
        $this->getJson('/api/driver/orders?tab=available', $driverHeaders)
            ->assertOk()
            ->assertJsonCount(0);
        $this->getJson('/api/driver/orders?tab=active', $driverHeaders)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.status', 'on_the_way');
    }

    public function test_driver_queue_excludes_pickup_and_onsite_orders(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'is_main' => true,
        ]);
        $driver = Driver::create([
            'name' => 'Main System Driver',
            'email' => 'main-driver-queue@example.test',
            'password' => Hash::make('Driver@123'),
            'phone' => '09170000001',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
        $driverToken = 'main-driver-queue-token';
        $driver->api_token = hash('sha256', $driverToken);
        $driver->save();
        $headers = ['Authorization' => 'Bearer '.$driverToken];

        $delivery = $this->createOrder('DELIVERY-QUEUE-TEST', 'standard', 'Delivery address');
        $delivery->update([
            'branch_id' => $mainBranch->id,
            'fulfillment_type' => 'delivery',
            'status' => 'prepared',
        ]);
        $pickup = $this->createOrder('PICKUP-QUEUE-TEST', 'standard', 'Pickup address');
        $pickup->update([
            'branch_id' => $mainBranch->id,
            'fulfillment_type' => 'pickup',
            'status' => 'prepared',
        ]);
        $onsite = $this->createOrder('ONSITE-QUEUE-TEST', 'onsite', 'Onsite - Takeout');
        $onsite->update([
            'branch_id' => $mainBranch->id,
            'fulfillment_type' => 'pickup',
            'status' => 'prepared',
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Branch',
            'status' => 'active',
        ]);
        $misattributed = $this->createOrder('MISATTRIBUTED-QUEUE-TEST', 'standard', 'Other branch delivery');
        $misattributed->update([
            'branch_id' => $otherBranch->id,
            'franchise_id' => $mainBranch->id,
            'fulfillment_type' => 'delivery',
            'status' => 'prepared',
        ]);

        $this->getJson('/api/driver/orders?tab=available', $headers)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $delivery->id);
    }

    public function test_scheduled_orders_are_separated_until_their_prep_window_and_counts_update(): void
    {
        [$headers] = $this->createKitchenStaff();
        $scheduledOrder = $this->createOrder('SCHEDULED-FUTURE-TEST', 'scheduled', 'Customer delivery address');
        $scheduledOrder->update([
            'is_scheduled' => true,
            'scheduled_for' => Carbon::now()->addHours(2),
            'fulfillment_type' => 'delivery',
            'special_instructions' => 'No onions',
        ]);
        $promotedOrder = $this->createOrder('SCHEDULED-PREP-TEST', 'scheduled', 'Customer delivery address');
        $promotedOrder->update([
            'is_scheduled' => true,
            'scheduled_for' => Carbon::now()->addMinutes(20),
            'fulfillment_type' => 'pickup',
        ]);

        $this->getJson('/api/kitchen/orders?tab=scheduled', $headers)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['id' => $scheduledOrder->id, 'isScheduled' => true, 'specialInstructions' => 'No onions']);
        $this->getJson('/api/kitchen/orders?tab=pending', $headers)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['id' => $promotedOrder->id]);
        $this->getJson('/api/kitchen/orders/counts', $headers)
            ->assertOk()
            ->assertJsonPath('scheduled_count', 1)
            ->assertJsonPath('new_count', 1)
            ->assertJsonFragment(['id' => $promotedOrder->id]);
    }

    public function test_scheduled_orders_require_early_start_confirmation_and_can_be_rescheduled_or_cancelled(): void
    {
        [$headers] = $this->createKitchenStaff();
        $order = $this->createOrder('SCHEDULED-ACTIONS-TEST', 'scheduled', 'Customer delivery address');
        $originalSchedule = Carbon::now()->addHours(2);
        $order->update([
            'is_scheduled' => true,
            'scheduled_for' => $originalSchedule,
            'fulfillment_type' => 'delivery',
        ]);

        $this->patchJson('/api/kitchen/orders/'.$order->id.'/status', ['status' => 'preparing'], $headers)
            ->assertStatus(422);
        $this->patchJson('/api/kitchen/orders/'.$order->id.'/status', ['status' => 'preparing', 'start_early' => true], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        $pendingOrder = $this->createOrder('SCHEDULED-RESCHEDULE-TEST', 'scheduled', 'Customer delivery address');
        $pendingOrder->update([
            'is_scheduled' => true,
            'scheduled_for' => $originalSchedule,
            'fulfillment_type' => 'pickup',
        ]);
        $newSchedule = Carbon::now()->addHours(3)->toIso8601String();
        $this->patchJson('/api/kitchen/orders/'.$pendingOrder->id.'/schedule', ['scheduled_for' => $newSchedule], $headers)
            ->assertOk()
            ->assertJsonPath('order.isScheduled', true);
        $this->assertNotNull($pendingOrder->fresh()->rescheduled_from);

        $this->patchJson('/api/kitchen/orders/'.$pendingOrder->id.'/status', ['status' => 'cancelled'], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'cancelled');
    }

    /**
     * @return array{0: array<string, string>}
     */
    private function createKitchenStaff(?string $franchiseId = null): array
    {
        $franchiseId ??= Franchise::where('is_main', true)->value('id');
        if (! $franchiseId) {
            $franchiseId = Franchise::create([
                'name' => 'Cavite Branch',
                'status' => 'active',
                'is_main' => true,
            ])->id;
        }

        $kitchenStaff = Employee::create([
            'fullName' => 'Main Kitchen',
            'email' => 'kitchen-'.uniqid().'@example.com',
            'password' => Hash::make('Kitchen@123'),
            'position' => 'kitchen staff',
            'franchise_id' => $franchiseId,
        ]);
        $token = 'main-kitchen-token-'.uniqid();
        $kitchenStaff->api_token = hash('sha256', $token);
        $kitchenStaff->save();

        return [['Authorization' => 'Bearer '.$token]];
    }

    private function createOrder(string $id, string $deliveryType, string $address): Order
    {
        $mainBranchId = Franchise::where('is_main', true)->value('id');

        return Order::create([
            'id' => $id,
            'branch_id' => $mainBranchId,
            'franchise_id' => $mainBranchId,
            'email' => strtolower($id).'@example.com',
            'order_number' => $id.'-NUMBER',
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => $address,
            'phone' => '09170000000',
            'items' => [],
            'delivery_type' => $deliveryType,
            'delivery_calculation_method' => $deliveryType === 'onsite' ? 'onsite' : 'base_fee_plus_distance_rate_capped',
        ]);
    }
}

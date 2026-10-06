<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KitchenOrderChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_prepared_walk_in_orders_become_delivered_without_changing_online_orders(): void
    {
        $kitchenStaff = Employee::create([
            'fullName' => 'Main Kitchen',
            'email' => 'kitchen@example.com',
            'password' => Hash::make('Kitchen@123'),
            'position' => 'kitchen staff',
        ]);
        $token = 'main-kitchen-token';
        $kitchenStaff->api_token = hash('sha256', $token);
        $kitchenStaff->save();
        $headers = ['Authorization' => 'Bearer ' . $token];

        $onsiteOrder = $this->createOrder('ONSITE-CHANNEL-TEST', 'onsite', 'Onsite - Takeout (Customer: Walk-in Customer)');
        $onlineOrder = $this->createOrder('ONLINE-CHANNEL-TEST', 'standard', 'Customer delivery address');

        $this->patchJson('/api/kitchen/orders/'.$onsiteOrder->id.'/status', ['status' => 'prepared'], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'delivered');

        $this->patchJson('/api/kitchen/orders/'.$onlineOrder->id.'/status', ['status' => 'prepared'], $headers)
            ->assertOk()
            ->assertJsonPath('order.status', 'prepared');

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonFragment(['id' => $onsiteOrder->id, 'channel' => 'onsite'])
            ->assertJsonFragment(['id' => $onlineOrder->id, 'channel' => 'online']);
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
    private function createKitchenStaff(): array
    {
        $kitchenStaff = Employee::create([
            'fullName' => 'Main Kitchen',
            'email' => 'kitchen-'.uniqid().'@example.com',
            'password' => Hash::make('Kitchen@123'),
            'position' => 'kitchen staff',
        ]);
        $token = 'main-kitchen-token-'.uniqid();
        $kitchenStaff->api_token = hash('sha256', $token);
        $kitchenStaff->save();

        return [['Authorization' => 'Bearer '.$token]];
    }

    private function createOrder(string $id, string $deliveryType, string $address): Order
    {
        return Order::create([
            'id' => $id,
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

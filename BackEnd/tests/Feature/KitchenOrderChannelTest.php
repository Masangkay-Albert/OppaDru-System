<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Employee;
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

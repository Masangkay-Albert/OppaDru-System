<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReplacementRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderReplacementReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_approval_creates_a_free_replacement_and_marks_the_request_handled(): void
    {
        [$headers, $admin] = $this->adminHeaders();
        $order = $this->order();
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_name' => 'Chicken rice bowl',
            'product_price' => 180,
            'quantity' => 1,
        ]);
        $replacementRequest = $this->request($order, [[
            'order_item_id' => $item->id,
            'name' => 'Chicken rice bowl',
            'quantity' => 1,
        ]]);

        $response = $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'approve',
        ], $headers)->assertOk()
            ->assertJsonPath('request.status', 'approved')
            ->assertJsonPath('message', 'Replacement order created.');

        $replacementId = $response->json('replacement_order.id');
        $this->assertDatabaseHas('orders', [
            'id' => $replacementId,
            'replacement_of_order_id' => $order->id,
            'branch_id' => $order->branch_id,
            'total' => 0,
            'payment_method' => 'replacement',
        ]);
        $this->assertDatabaseHas('order_replacement_requests', [
            'id' => $replacementRequest->id,
            'status' => 'approved',
            'handled_by' => $admin->id,
            'handled_by_name' => 'Replacement Admin',
            'replacement_order_id' => $replacementId,
        ]);
    }

    public function test_notification_failure_does_not_turn_a_committed_approval_into_a_server_error(): void
    {
        [$headers] = $this->adminHeaders();
        $customer = User::create([
            'full_name' => 'Replacement Customer',
            'email' => 'replacement-customer@test.local',
            'password' => Hash::make('Customer@123'),
        ]);
        $order = $this->order();
        $order->update(['user_id' => $customer->id]);
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_name' => 'Chicken rice bowl',
            'product_price' => 180,
            'quantity' => 1,
        ]);
        $replacementRequest = $this->request($order, [[
            'order_item_id' => $item->id,
            'name' => 'Chicken rice bowl',
            'quantity' => 1,
        ]], ['user_id' => $customer->id]);
        Notification::shouldReceive('send')
            ->once()
            ->andThrow(new \RuntimeException('Mail transport unavailable'));

        $response = $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'approve',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('replacement_order.id'),
            'replacement_of_order_id' => $order->id,
        ]);
    }

    public function test_admin_can_reject_a_request_with_a_reason(): void
    {
        [$headers, $admin] = $this->adminHeaders();
        $replacementRequest = $this->request($this->order(), []);

        $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'reject',
            'reject_reason' => 'The photo does not show a food quality issue.',
        ], $headers)->assertOk()
            ->assertJsonPath('request.status', 'rejected');

        $this->assertDatabaseHas('order_replacement_requests', [
            'id' => $replacementRequest->id,
            'status' => 'rejected',
            'reject_reason' => 'The photo does not show a food quality issue.',
            'handled_by' => $admin->id,
            'handled_by_name' => 'Replacement Admin',
        ]);
    }

    public function test_handled_request_returns_conflict_without_creating_another_replacement(): void
    {
        [$headers] = $this->adminHeaders();
        $order = $this->order();
        $replacementRequest = $this->request($order, [], ['status' => 'rejected']);

        $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'approve',
        ], $headers)->assertStatus(409)
            ->assertJsonPath('message', 'This replacement request has already been handled.');

        $this->assertDatabaseMissing('orders', ['replacement_of_order_id' => $order->id]);
    }

    public function test_missing_request_returns_not_found(): void
    {
        [$headers] = $this->adminHeaders();

        $this->patchJson('/api/admin/replacement-requests/missing-request', [
            'action' => 'approve',
        ], $headers)->assertNotFound()
            ->assertJsonPath('message', 'Replacement request was not found.');
    }

    public function test_missing_original_order_returns_a_clear_validation_error(): void
    {
        [$headers] = $this->adminHeaders();
        $replacementRequest = OrderReplacementRequest::create([
            'order_id' => 'missing-original-order',
            'issue_type' => 'wrong_item',
            'affected_items' => [['order_item_id' => 999, 'quantity' => 1]],
            'description' => 'The order item was incorrect.',
            'photo_paths' => [],
            'status' => 'pending',
        ]);

        $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'approve',
        ], $headers)->assertStatus(422)
            ->assertJsonPath('message', 'The original order is no longer available. Please contact support.');

        $this->assertDatabaseHas('order_replacement_requests', [
            'id' => $replacementRequest->id,
            'status' => 'pending',
        ]);
    }

    public function test_missing_affected_order_item_returns_validation_error_without_handling_request(): void
    {
        [$headers] = $this->adminHeaders();
        $replacementRequest = $this->request($this->order(), [[
            'order_item_id' => 999,
            'name' => 'Removed item',
            'quantity' => 1,
        ]]);

        $this->patchJson('/api/admin/replacement-requests/'.$replacementRequest->id, [
            'action' => 'approve',
        ], $headers)->assertStatus(422)
            ->assertJsonPath('message', 'One or more selected items no longer belong to this order.');

        $this->assertDatabaseHas('order_replacement_requests', [
            'id' => $replacementRequest->id,
            'status' => 'pending',
            'replacement_order_id' => null,
        ]);
    }

    private function adminHeaders(): array
    {
        $token = 'replacement-review-admin-token';
        $admin = Admin::create([
            'full_name' => 'Replacement Admin',
            'email' => 'replacement-admin@test.local',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return [['Authorization' => 'Bearer '.$token], $admin];
    }

    private function order(): Order
    {
        $branch = Franchise::create([
            'name' => 'Replacement Review Main Branch',
            'status' => 'active',
            'is_main' => true,
        ]);

        return Order::create([
            'branch_id' => $branch->id,
            'franchise_id' => $branch->id,
            'email' => 'customer@test.local',
            'phone' => '09170000000',
            'items' => [],
            'total' => 180,
            'delivery_type' => 'standard',
            'delivery_address' => 'Customer delivery address',
            'payment_method' => 'cash_on_delivery',
            'payment_status' => 'paid',
            'status' => 'delivered',
        ]);
    }

    private function request(Order $order, array $items, array $overrides = []): OrderReplacementRequest
    {
        return OrderReplacementRequest::create(array_merge([
            'order_id' => $order->id,
            'issue_type' => 'wrong_item',
            'affected_items' => $items,
            'description' => 'The wrong item was delivered.',
            'photo_paths' => [],
            'status' => 'pending',
        ], $overrides));
    }
}

<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Franchise;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CashierPopularMealsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_popular_meals_requires_authentication_and_is_scoped_to_employee_branch(): void
    {
        $branch = Franchise::create([
            'name' => 'Cashier Popular Branch',
            'status' => 'active',
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Popular Branch',
            'status' => 'active',
        ]);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Branch Cashier',
            'email' => 'popular.cashier@example.test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $token = 'popular-cashier-token';
        $employee->api_token = hash('sha256', $token);
        $employee->save();
        $headers = ['Authorization' => 'Bearer '.$token];

        $branchOrder = $this->createSale($branch, 'Branch Meal', 3);
        $this->createSale($otherBranch, 'Other Branch Meal', 10);
        Cache::forget('popular_meals_'.$branch->id.'_'.now()->format('Y_m').'_lim_10');

        $this->getJson('/api/cashier/popular-meals?limit=10')
            ->assertUnauthorized();

        $this->getJson('/api/cashier/popular-meals?limit=10', $headers)
            ->assertOk()
            ->assertJsonPath('total_orders', 1)
            ->assertJsonPath('total_quantity_sold', 3)
            ->assertJsonPath('top_meals.0.name', 'Branch Meal')
            ->assertJsonPath('top_meals.0.quantity_sold', 3);

        $this->assertNotNull($branchOrder->fresh());
    }

    private function createSale(Franchise $branch, string $productName, int $quantity): Order
    {
        $order = Order::create([
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'cashier@example.test',
            'phone' => '',
            'total' => 100,
            'delivery_type' => 'onsite',
            'delivery_address' => 'Onsite - Takeout',
            'status' => 'completed',
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'items' => [],
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_name' => $productName,
            'product_price' => 100,
            'quantity' => $quantity,
        ]);

        return $order;
    }
}

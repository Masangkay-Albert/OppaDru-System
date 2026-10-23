<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Franchise;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CashierPopularMealsTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_pos_top_products_are_paid_branch_scoped_and_ranked_by_quantity(): void
    {
        $branch = Franchise::create(['name' => 'Top Products Branch', 'status' => 'active']);
        $otherBranch = Franchise::create(['name' => 'Other Top Products Branch', 'status' => 'active']);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Top Products Cashier',
            'email' => 'top.products@example.test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $token = 'top-products-cashier-token';
        $employee->api_token = hash('sha256', $token);
        $employee->save();
        $headers = ['Authorization' => 'Bearer '.$token];
        $popular = $this->makeProduct($branch, 'Popular Chicken', 415);
        $lessPopular = $this->makeProduct($branch, 'Less Popular Chicken', 428);
        $otherBranchProduct = $this->makeProduct($otherBranch, 'Other Branch Chicken', 500);

        $this->createProductSale($branch, $popular, 3);
        $this->createProductSale($branch, $lessPopular, 1);
        $this->createProductSale($otherBranch, $otherBranchProduct, 20);
        $this->createProductSale($branch, $popular, 9, 'cancelled');
        foreach (['month', 'week', 'today'] as $period) {
            Cache::forget('employee_pos_top_products_'.$branch->id.'_'.$period.'_5_'.now('Asia/Manila')->format('Y_m_d'));
        }

        $this->getJson('/api/employee/pos/top-products?period=month&limit=5', $headers)
            ->assertOk()
            ->assertJsonPath('0.productId', $popular->id)
            ->assertJsonPath('0.name', $popular->name)
            ->assertJsonPath('0.qtySold', 3)
            ->assertJsonPath('0.revenue', 1245)
            ->assertJsonPath('0.rank', 1)
            ->assertJsonPath('1.productId', $lessPopular->id)
            ->assertJsonPath('1.rank', 2);

        $this->getJson('/api/employee/pos/top-products?period=week', $headers)
            ->assertOk()
            ->assertJsonPath('0.qtySold', 3);

        $this->getJson('/api/employee/pos/top-products?period=today', $headers)
            ->assertOk()
            ->assertJsonPath('0.qtySold', 3);

        $this->getJson('/api/employee/pos/top-products?period=last_month', $headers)
            ->assertOk()
            ->assertExactJson([]);

        $this->getJson('/api/employee/pos/top-products?period=invalid', $headers)
            ->assertBadRequest()
            ->assertJsonPath('success', false);
    }

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

    private function makeProduct(Franchise $branch, string $name, float $price): Product
    {
        return Product::create([
            'name' => $name,
            'description' => $name,
            'price' => $price,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
    }

    private function createProductSale(Franchise $branch, Product $product, int $quantity, string $status = 'completed'): Order
    {
        $order = Order::create([
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'cashier@example.test',
            'phone' => '',
            'total' => $product->price * $quantity,
            'delivery_type' => 'onsite',
            'delivery_address' => 'Onsite - Takeout',
            'status' => $status,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'items' => [],
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'product_price' => $product->price,
            'quantity' => $quantity,
        ]);

        return $order;
    }
}

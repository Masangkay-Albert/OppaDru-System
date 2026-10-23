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
        $this->createProductSale($branch, $popular, 2, 'completed', 'delivery');
        $this->createProductSale($branch, $lessPopular, 1);
        $this->createProductSale($otherBranch, $otherBranchProduct, 20);
        $this->createProductSale($branch, $popular, 9, 'cancelled');
        foreach (['month', 'last_month'] as $period) {
            Cache::forget('employee_pos_top_products_'.$branch->id.'_'.$period.'_5_'.now('Asia/Manila')->format('Y_m_d'));
        }
        Cache::forget('employee_pos_top_products_'.$branch->id.'_'.now('Asia/Manila')->format('Y_m').'_5');

        $this->getJson('/api/employee/pos/top-products?period=month&limit=5', $headers)
            ->assertOk()
            ->assertJsonPath('0.productId', $popular->id)
            ->assertJsonPath('0.name', $popular->name)
            ->assertJsonPath('0.qtySold', 3)
            ->assertJsonPath('0.revenue', 1245)
            ->assertJsonPath('0.rank', 1)
            ->assertJsonPath('1.productId', $lessPopular->id)
            ->assertJsonPath('1.rank', 2);

        $this->getJson('/api/employee/pos/top-products?period=last_month', $headers)
            ->assertOk()
            ->assertExactJson([]);

        $this->getJson('/api/employee/pos/top-products?period=week', $headers)
            ->assertBadRequest()
            ->assertJsonPath('success', false);
    }

    public function test_employee_pos_top_products_can_be_filtered_by_calendar_month(): void
    {
        $branch = Franchise::create(['name' => 'Monthly Top Products Branch', 'status' => 'active']);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Monthly Top Products Cashier',
            'email' => 'monthly.top.products@example.test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $token = 'monthly-top-products-token';
        $employee->api_token = hash('sha256', $token);
        $employee->save();
        $headers = ['Authorization' => 'Bearer '.$token];
        $januaryProduct = $this->makeProduct($branch, 'January Chicken', 200);
        $decemberProduct = $this->makeProduct($branch, 'December Chicken', 300);

        $this->createProductSale($branch, $januaryProduct, 2, 'completed', 'onsite', '2026-01-31 15:59:59');
        $this->createProductSale($branch, $decemberProduct, 4, 'completed', 'onsite', '2025-12-31 15:59:59');
        Cache::forget('employee_pos_top_products_'.$branch->id.'_2026_01_100');
        Cache::forget('employee_pos_top_products_'.$branch->id.'_2025_12_100');

        $this->getJson('/api/employee/pos/top-products?month=2026-01&limit=100', $headers)
            ->assertOk()
            ->assertJsonPath('0.productId', $januaryProduct->id)
            ->assertJsonPath('0.qtySold', 2)
            ->assertJsonPath('0.revenue', 400)
            ->assertJsonCount(1);

        $this->getJson('/api/employee/pos/top-products?month=2025-12&limit=100', $headers)
            ->assertOk()
            ->assertJsonPath('0.productId', $decemberProduct->id)
            ->assertJsonPath('0.qtySold', 4)
            ->assertJsonPath('0.revenue', 1200)
            ->assertJsonCount(1);

        $this->getJson('/api/employee/pos/top-products?month=2026-13', $headers)
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

    public function test_employee_pos_orders_include_order_item_details_for_cashier_drawer(): void
    {
        $branch = Franchise::create(['name' => 'Cashier Orders Branch', 'status' => 'active']);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Orders Cashier',
            'email' => 'orders.cashier@example.test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $token = 'cashier-orders-token';
        $employee->api_token = hash('sha256', $token);
        $employee->save();
        $product = $this->makeProduct($branch, 'Drawer Chicken', 250);
        $order = $this->createProductSale($branch, $product, 2);
        $order->update([
            'cashier_employee_id' => $employee->id,
            'delivery_address' => 'Onsite - Dine In (Customer: Sean) | Table 4',
            'cash_tendered' => 600,
            'change_due' => 100,
        ]);

        $this->getJson('/api/employee/pos/orders', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.0.id', $order->id)
            ->assertJsonPath('data.0.delivery_type', 'onsite')
            ->assertJsonPath('data.0.cash_tendered', '600.00')
            ->assertJsonPath('data.0.change_due', '100.00')
            ->assertJsonPath('data.0.order_items.0.product_name', 'Drawer Chicken')
            ->assertJsonPath('data.0.order_items.0.quantity', 2);
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

    private function createProductSale(
        Franchise $branch,
        Product $product,
        int $quantity,
        string $status = 'completed',
        string $deliveryType = 'onsite',
        ?string $createdAt = null
    ): Order
    {
        $orderData = [
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'cashier@example.test',
            'phone' => '',
            'total' => $product->price * $quantity,
            'delivery_type' => $deliveryType,
            'delivery_address' => $deliveryType === 'onsite' ? 'Onsite - Takeout' : 'Delivery address',
            'status' => $status,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'items' => [],
        ];
        if ($createdAt !== null) {
            $orderData['created_at'] = $createdAt;
            $orderData['updated_at'] = $createdAt;
        }
        $order = Order::create($orderData);
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

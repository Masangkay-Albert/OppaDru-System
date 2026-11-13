<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\BranchIngredientStock;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\IngredientRecipe;
use App\Models\InventoryTransfer;
use App\Models\MainBranchIngredient;
use App\Models\Order;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MainBranchInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        Admin::create([
            'full_name' => 'Inventory Admin',
            'email' => 'inventory-admin@example.test',
            'password' => Hash::make('Password123'),
            'api_token' => hash('sha256', 'inventory-token'),
            'role' => Admin::ROLE_ADMIN,
        ]);

        return ['Authorization' => 'Bearer inventory-token'];
    }

    public function test_admin_can_create_decimal_stock_and_records_opening_movement(): void
    {
        $headers = $this->adminHeaders();

        $this->postJson('/api/admin/inventory', [
            'name' => 'Fresh milk',
            'category' => 'Dairy',
            'unit' => 'l',
            'quantity' => 2.5,
            'reorder_level' => 1.25,
            'unit_cost' => 84.50,
        ], $headers)->assertCreated()
            ->assertJsonPath('data.quantity', '2.500')
            ->assertJsonPath('data.reorder_level', '1.250');

        $this->assertDatabaseHas('stock_movements', [
            'type' => 'opening_stock',
            'quantity' => 2.5,
            'quantity_before' => 0,
            'quantity_after' => 2.5,
        ]);
    }

    public function test_stock_changes_are_audited_and_cannot_go_below_zero(): void
    {
        $headers = $this->adminHeaders();
        $ingredient = MainBranchIngredient::create([
            'name' => 'Cooking oil',
            'category' => 'Dry goods',
            'unit' => 'l',
            'quantity' => 5,
            'reorder_level' => 1,
        ]);

        $this->postJson("/api/admin/inventory/{$ingredient->id}/adjustments", [
            'type' => 'stock_out',
            'quantity' => 2.5,
        ], $headers)->assertOk()->assertJsonPath('data.quantity', '2.500');

        $this->postJson("/api/admin/inventory/{$ingredient->id}/adjustments", [
            'type' => 'waste',
            'quantity' => 3,
            'reason' => 'Spill',
        ], $headers)->assertUnprocessable()
            ->assertJsonPath('message', 'This adjustment would make the stock negative.');

        $this->assertDatabaseHas('main_branch_ingredients', ['id' => $ingredient->id, 'quantity' => 2.5]);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_ingredient_names_are_unique_without_case_sensitivity(): void
    {
        $headers = $this->adminHeaders();
        MainBranchIngredient::create([
            'name' => 'Chicken Breast',
            'category' => 'Meat',
            'unit' => 'kg',
            'quantity' => 0,
            'reorder_level' => 1,
        ]);

        $this->postJson('/api/admin/inventory', [
            'name' => 'chicken breast',
            'category' => 'Meat',
            'unit' => 'kg',
            'quantity' => 0,
            'reorder_level' => 1,
        ], $headers)->assertUnprocessable()
            ->assertJsonPath('message', 'An ingredient with this name already exists.');
    }

    public function test_inventory_endpoints_are_admin_only(): void
    {
        $this->getJson('/api/admin/inventory')->assertUnauthorized();
        $this->postJson('/api/admin/inventory', [])->assertUnauthorized();
    }

    public function test_receiving_converts_purchase_quantity_and_updates_weighted_average_cost(): void
    {
        $headers = $this->adminHeaders();
        $ingredient = MainBranchIngredient::create([
            'name' => 'Rice',
            'category' => 'Dry goods',
            'unit' => 'kg',
            'purchase_unit' => 'bag',
            'conversion_factor' => 5,
            'quantity' => 10,
            'unit_cost' => 100,
            'reorder_level' => 2,
        ]);

        $this->postJson("/api/admin/inventory/{$ingredient->id}/receive", [
            'quantity' => 2,
            'unit_cost' => 250,
            'invoice_reference' => 'INV-100',
        ], $headers)->assertOk()->assertJsonPath('data.quantity', '20.000');

        $ingredient->refresh();
        $this->assertSame('75.00', $ingredient->unit_cost);
        $this->assertDatabaseHas('stock_movements', [
            'ingredient_id' => $ingredient->id,
            'type' => 'stock_in',
            'quantity' => 10,
            'purchase_quantity' => 2,
            'purchase_unit' => 'bag',
            'invoice_reference' => 'INV-100',
        ]);
    }

    public function test_recipe_usage_is_deducted_once_and_reversed_on_cancel(): void
    {
        $branch = Franchise::create([
            'name' => 'Main Branch',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $product = Product::create([
            'name' => 'Rice Bowl',
            'description' => 'Recipe test product',
            'price' => 100,
            'category' => 'rice-meals',
            'image' => '',
            'is_available' => true,
        ]);
        $ingredient = MainBranchIngredient::create([
            'name' => 'Cooked rice',
            'category' => 'Dry goods',
            'unit' => 'kg',
            'quantity' => 10,
            'reorder_level' => 1,
            'unit_cost' => 30,
        ]);
        IngredientRecipe::create([
            'product_id' => $product->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 2,
            'unit' => 'kg',
        ]);
        $order = Order::create([
            'id' => 'INVENTORY-RECIPE-ORDER',
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'customer@example.test',
            'total' => 200,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test address',
            'phone' => '09171234567',
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'delivery_type' => 'standard',
        ]);
        $inventory = app(InventoryService::class);

        $inventory->deductForOrder($order);
        $inventory->deductForOrder($order);
        $this->assertSame('6.000', $ingredient->fresh()->quantity);
        $this->assertDatabaseCount('order_ingredient_deductions', 1);

        $inventory->reverseOrder($order);
        $inventory->reverseOrder($order);
        $this->assertSame('10.000', $ingredient->fresh()->quantity);
        $this->assertDatabaseHas('order_ingredient_deductions', [
            'order_id' => $order->id,
            'is_reversed' => 1,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'order_id' => $order->id,
            'type' => 'adjustment',
            'quantity_change' => 4,
        ]);
    }

    public function test_marking_an_order_refunded_reverses_recipe_usage(): void
    {
        $branch = Franchise::create([
            'name' => 'Refund reversal branch',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $product = Product::create([
            'name' => 'Refund test meal',
            'description' => 'Refund test recipe',
            'price' => 50,
            'category' => 'rice-meals',
            'image' => '',
            'is_available' => true,
        ]);
        $ingredient = MainBranchIngredient::create([
            'name' => 'Refund test ingredient',
            'category' => 'Dry goods',
            'unit' => 'kg',
            'quantity' => 5,
            'reorder_level' => 1,
        ]);
        IngredientRecipe::create([
            'product_id' => $product->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 1,
            'unit' => 'kg',
        ]);
        $order = Order::create([
            'id' => 'INVENTORY-REFUND-ORDER',
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'refund-customer@example.test',
            'total' => 50,
            'status' => 'pending',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Refund test address',
            'phone' => '09171234567',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery_type' => 'standard',
        ]);
        $inventory = app(InventoryService::class);
        $inventory->deductForOrder($order);
        $this->assertSame('4.000', $ingredient->fresh()->quantity);

        $order->update(['payment_status' => 'refunded']);

        $this->assertSame('5.000', $ingredient->fresh()->quantity);
        $this->assertDatabaseHas('order_ingredient_deductions', [
            'order_id' => $order->id,
            'is_reversed' => 1,
        ]);
    }

    public function test_branch_transfer_preserves_expiry_lots_and_order_usage_is_fefo(): void
    {
        $main = Franchise::create([
            'name' => 'Main for transfer',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $branch = Franchise::create([
            'name' => 'Branch for transfer',
            'status' => 'active',
            'is_active' => true,
        ]);
        $ingredient = MainBranchIngredient::create([
            'name' => 'Fresh chicken',
            'category' => 'Meat',
            'unit' => 'kg',
            'quantity' => 0,
            'reorder_level' => 1,
        ]);
        $inventory = app(InventoryService::class);
        $inventory->move($ingredient->id, 'stock_in', 2, 'Lot A', null, ['expires_at' => now()->addDays(2)->toDateString()]);
        $inventory->move($ingredient->id, 'stock_in', 3, 'Lot B', null, ['expires_at' => now()->addDays(5)->toDateString()]);
        $dispatch = $inventory->dispatchToBranch($ingredient->id, 4);
        $this->assertSame('1.000', $ingredient->fresh()->quantity);
        $this->assertDatabaseMissing('branch_ingredient_stocks', ['branch_id' => $branch->id, 'ingredient_id' => $ingredient->id]);
        $inventory->receiveTransferItem(
            (string) $branch->id,
            $ingredient->id,
            4,
            (float) $dispatch['movement']->unit_cost,
            $dispatch['batch_lots'],
        );

        $product = Product::create([
            'name' => 'Chicken portion',
            'description' => 'Recipe item',
            'price' => 150,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);
        IngredientRecipe::create([
            'product_id' => $product->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 1,
            'unit' => 'kg',
        ]);
        $order = Order::create([
            'id' => 'BRANCH-RECIPE-FEFO',
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'branch-customer@example.test',
            'total' => 450,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Branch delivery address',
            'phone' => '09171234567',
            'items' => [['product_id' => $product->id, 'quantity' => 3]],
            'delivery_type' => 'standard',
        ]);

        $inventory->deductForOrder($order);
        $this->assertSame('1.000', BranchIngredientStock::where('branch_id', $branch->id)->where('ingredient_id', $ingredient->id)->value('quantity'));
        $batchQuantities = DB::table('stock_batches')
            ->where('branch_id', $branch->id)
            ->where('ingredient_id', $ingredient->id)
            ->orderBy('expires_at')
            ->pluck('quantity_remaining')
            ->map(fn ($quantity) => (float) $quantity)
            ->all();
        $this->assertSame([0.0, 1.0], $batchQuantities);

        $inventory->reverseOrder($order);
        $this->assertSame('4.000', BranchIngredientStock::where('branch_id', $branch->id)->where('ingredient_id', $ingredient->id)->value('quantity'));
        $restoredBatchQuantities = DB::table('stock_batches')
            ->where('branch_id', $branch->id)
            ->where('ingredient_id', $ingredient->id)
            ->orderBy('expires_at')
            ->pluck('quantity_remaining')
            ->map(fn ($quantity) => (float) $quantity)
            ->all();
        $this->assertSame([2.0, 2.0], $restoredBatchQuantities);
    }

    public function test_expired_batches_cannot_be_used_for_order_deduction(): void
    {
        $branch = Franchise::create([
            'name' => 'Main expiry test',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $ingredient = MainBranchIngredient::create([
            'name' => 'Expired flour',
            'category' => 'Dry goods',
            'unit' => 'kg',
            'quantity' => 0,
            'reorder_level' => 1,
        ]);
        $inventory = app(InventoryService::class);
        $inventory->move($ingredient->id, 'stock_in', 2, 'Expired lot', null, ['expires_at' => now()->subDay()->toDateString()]);
        $inventory->move($ingredient->id, 'stock_in', 3, 'Fresh lot', null, ['expires_at' => now()->addDays(4)->toDateString()]);

        $this->assertSame(3.0, $inventory->availableQuantity($ingredient->id));
        $this->expectException(\InvalidArgumentException::class);
        $inventory->move($ingredient->id, 'order_usage', 4, 'Test usage');
    }

    public function test_summary_uses_each_reorder_level_and_excludes_expired_stock(): void
    {
        $headers = $this->adminHeaders();
        $ingredient = MainBranchIngredient::create([
            'name' => 'Short-dated cheese',
            'category' => 'Dairy',
            'unit' => 'kg',
            'quantity' => 5,
            'reorder_level' => 4,
        ]);
        MainBranchIngredient::create([
            'name' => 'Empty packaging',
            'category' => 'Packaging',
            'unit' => 'pcs',
            'quantity' => 0,
            'reorder_level' => 0,
        ]);
        DB::table('stock_batches')->insert([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 2,
            'quantity_remaining' => 2,
            'expires_at' => now()->subDay()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/admin/inventory/summary', $headers)
            ->assertOk()
            ->assertJsonPath('data.total', 2)
            ->assertJsonPath('data.low_stock', 1)
            ->assertJsonPath('data.out_of_stock', 1);
    }

    public function test_csv_import_reports_invalid_duplicate_rows_without_skipping_valid_rows(): void
    {
        $headers = $this->adminHeaders();
        $csv = UploadedFile::fake()->createWithContent(
            'ingredients.csv',
            "name,category,unit,quantity,reorder_level,unit_cost,supplier,notes\nEggs,Dairy,pcs,2,1,8.5,Local Dairy,Organic\neggs,Dairy,pcs,1,1,8.5,Local Dairy,Duplicate\n",
        );

        $this->postJson('/api/admin/inventory/import', ['file' => $csv], $headers)
            ->assertOk()
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.errors.0.row', 3);
        $this->assertDatabaseHas('main_branch_ingredients', ['name' => 'Eggs', 'quantity' => 2]);
        $this->assertDatabaseHas('main_branch_ingredients', ['name' => 'Eggs', 'notes' => 'Organic']);
        $this->assertDatabaseHas('inventory_suppliers', ['name' => 'Local Dairy']);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_franchise_transfer_receipt_is_limited_to_the_destination_branch(): void
    {
        $main = Franchise::create([
            'name' => 'Main scoped branch',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $destination = Franchise::create([
            'name' => 'Destination scoped branch',
            'status' => 'active',
            'is_active' => true,
        ]);
        $other = Franchise::create([
            'name' => 'Other scoped branch',
            'status' => 'active',
            'is_active' => true,
        ]);
        $manager = FranchiseUser::create([
            'franchise_id' => $other->id,
            'full_name' => 'Scoped Inventory Manager',
            'email' => 'scoped-inventory-manager@example.test',
            'password' => Hash::make('Manager@123'),
            'role' => 'manager',
            'is_active' => true,
        ]);
        $transfer = InventoryTransfer::create([
            'source_branch_id' => $main->id,
            'destination_branch_id' => $destination->id,
            'reference' => 'TRF-SCOPE-TEST',
            'status' => 'dispatched',
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();

        $this->patchJson("/api/franchise/inventory/transfers/{$transfer->id}/receive", [], [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])->assertNotFound();
        $this->assertDatabaseHas('inventory_transfers', ['id' => $transfer->id, 'status' => 'dispatched']);
    }
}

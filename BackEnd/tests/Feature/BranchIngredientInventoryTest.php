<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\BranchIngredientStock;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\IngredientRecipe;
use App\Models\InventoryRestockRequest;
use App\Models\InventoryRestockRequestItem;
use App\Models\MainBranchIngredient;
use App\Models\Order;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BranchIngredientInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function branch(string $name): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'status' => 'active',
            'is_active' => true,
        ]);
    }

    private function userHeaders(Franchise $branch, string $role): array
    {
        $user = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => ucfirst($role).' Inventory User',
            'email' => $role.'-'.strtolower(str_replace(' ', '-', $branch->name)).'@example.test',
            'password' => Hash::make('Password123'),
            'role' => $role,
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $user->email,
            'password' => 'Password123',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('token')];
    }

    private function adminHeaders(): array
    {
        Admin::create([
            'full_name' => 'Branch Inventory Admin',
            'email' => 'branch-inventory-admin@example.test',
            'password' => Hash::make('Password123'),
            'api_token' => hash('sha256', 'branch-inventory-token'),
            'role' => Admin::ROLE_ADMIN,
        ]);

        return ['Authorization' => 'Bearer branch-inventory-token'];
    }

    private function ingredient(string $name): MainBranchIngredient
    {
        return MainBranchIngredient::create([
            'name' => $name,
            'category' => 'Dry goods',
            'unit' => 'kg',
            'quantity' => 0,
            'reorder_level' => 2,
            'unit_cost' => 80,
        ]);
    }

    public function test_branch_inventory_is_scoped_and_untracked_catalog_is_separate(): void
    {
        $branch = $this->branch('Branch One');
        $otherBranch = $this->branch('Branch Two');
        $tracked = $this->ingredient('Rice');
        $otherTracked = $this->ingredient('Flour');
        BranchIngredientStock::create([
            'branch_id' => $branch->id,
            'ingredient_id' => $tracked->id,
            'quantity' => 4,
            'reorder_level' => 1,
        ]);
        BranchIngredientStock::create([
            'branch_id' => $otherBranch->id,
            'ingredient_id' => $otherTracked->id,
            'quantity' => 6,
            'reorder_level' => 1,
        ]);

        $this->getJson('/api/franchise/inventory/ingredients', $this->userHeaders($branch, 'staff'))
            ->assertOk()
            ->assertJsonPath('data.summary.total', 1)
            ->assertJsonPath('data.ingredients.0.name', 'Rice')
            ->assertJsonPath('data.available_ingredients.0.name', 'Flour');
    }

    public function test_dashboard_reports_branch_ingredient_counts(): void
    {
        $branch = $this->branch('Dashboard Ingredient Branch');
        $low = $this->ingredient('Low branch ingredient');
        $out = $this->ingredient('Out branch ingredient');
        BranchIngredientStock::create([
            'branch_id' => $branch->id,
            'ingredient_id' => $low->id,
            'quantity' => 1,
            'reorder_level' => 2,
        ]);
        BranchIngredientStock::create([
            'branch_id' => $branch->id,
            'ingredient_id' => $out->id,
            'quantity' => 0,
            'reorder_level' => 2,
        ]);

        $this->getJson('/api/franchise/dashboard', $this->userHeaders($branch, 'owner'))
            ->assertOk()
            ->assertJsonPath('data.ingredient_inventory_items', 2)
            ->assertJsonPath('data.ingredient_low_stock_items', 1)
            ->assertJsonPath('data.ingredient_out_of_stock_items', 1);
    }

    public function test_managers_can_add_and_adjust_branch_stock_but_staff_are_read_only(): void
    {
        $branch = $this->branch('Managed Branch');
        $ingredient = $this->ingredient('Cooking oil');
        $staffHeaders = $this->userHeaders($branch, 'staff');

        $this->getJson('/api/franchise/inventory/ingredients', $staffHeaders)->assertOk();
        $this->postJson('/api/franchise/inventory/ingredients', [
            'ingredient_id' => $ingredient->id,
            'initial_quantity' => 2.5,
            'reorder_level' => 1,
            'unit_cost' => 90,
        ], $staffHeaders)->assertForbidden();

        $managerHeaders = $this->userHeaders($branch, 'manager');
        $this->postJson('/api/franchise/inventory/ingredients', [
            'ingredient_id' => $ingredient->id,
            'initial_quantity' => 2.5,
            'reorder_level' => 1,
            'unit_cost' => 90,
        ], $managerHeaders)->assertCreated()
            ->assertJsonPath('data.quantity', '2.500');

        $this->postJson("/api/franchise/inventory/ingredients/{$ingredient->id}/adjustments", [
            'type' => 'stock_out',
            'quantity' => 3,
        ], $managerHeaders)->assertUnprocessable()
            ->assertJsonPath('message', 'This adjustment would make the stock negative.');

        $this->assertDatabaseHas('branch_ingredient_stocks', [
            'branch_id' => $branch->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 2.5,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'branch_id' => $branch->id,
            'ingredient_id' => $ingredient->id,
            'type' => 'opening_stock',
            'quantity_after' => 2.5,
        ]);
    }

    public function test_managers_can_create_a_shared_ingredient_and_opening_branch_stock(): void
    {
        $branch = $this->branch('New Ingredient Branch');
        $headers = $this->userHeaders($branch, 'manager');

        $this->postJson('/api/franchise/inventory/ingredients', [
            'name' => 'Branch-created napkins',
            'category' => 'Packaging',
            'unit' => 'pack',
            'purchase_unit' => 'box',
            'conversion_factor' => 12,
            'initial_quantity' => 4,
            'reorder_level' => 2,
            'unit_cost' => 35,
            'notes' => 'Store in the dry area.',
        ], $headers)->assertCreated()
            ->assertJsonPath('data.name', 'Branch-created napkins')
            ->assertJsonPath('data.unit', 'pack')
            ->assertJsonPath('data.quantity', '4.000');

        $this->assertDatabaseHas('main_branch_ingredients', [
            'name' => 'Branch-created napkins',
            'category' => 'Packaging',
            'unit' => 'pack',
            'purchase_unit' => 'box',
            'conversion_factor' => 12,
            'quantity' => 0,
        ]);
        $this->assertDatabaseHas('branch_ingredient_stocks', [
            'branch_id' => $branch->id,
            'ingredient_id' => MainBranchIngredient::where('name', 'Branch-created napkins')->value('id'),
            'quantity' => 4,
            'reorder_level' => 2,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'branch_id' => $branch->id,
            'type' => 'opening_stock',
            'quantity_after' => 4,
        ]);
    }

    public function test_archiving_hides_branch_stock_without_deleting_it_or_its_history(): void
    {
        $branch = $this->branch('Archive Branch');
        $ingredient = $this->ingredient('Beans');
        $headers = $this->userHeaders($branch, 'owner');
        $stock = BranchIngredientStock::create([
            'branch_id' => $branch->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 4,
            'reorder_level' => 1,
        ]);
        app(InventoryService::class)->moveBranch((string) $branch->id, $ingredient->id, 'stock_in', 1, 'Starting test stock');

        $this->patchJson("/api/franchise/inventory/ingredients/{$ingredient->id}/archive", [], $headers)
            ->assertOk()
            ->assertJsonPath('data.is_archived', true);

        $this->assertDatabaseHas('branch_ingredient_stocks', ['id' => $stock->id, 'is_archived' => true]);
        $this->assertDatabaseHas('stock_movements', ['branch_id' => $branch->id, 'ingredient_id' => $ingredient->id]);
        $this->getJson('/api/franchise/inventory/ingredients', $headers)
            ->assertOk()
            ->assertJsonCount(0, 'data.ingredients');
    }

    public function test_untracked_recipe_ingredients_are_skipped_and_reversal_is_idempotent(): void
    {
        $branch = $this->branch('Untracked Recipe Branch');
        $ingredient = $this->ingredient('Untracked salt');
        $product = Product::create([
            'name' => 'Soup',
            'description' => 'Recipe test product',
            'price' => 100,
            'category' => 'soup',
            'image' => '',
            'is_available' => true,
        ]);
        IngredientRecipe::create([
            'product_id' => $product->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 0.1,
            'unit' => 'kg',
        ]);
        $order = Order::create([
            'id' => 'UNTRACKED-BRANCH-RECIPE',
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'email' => 'recipe@example.test',
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Branch address',
            'phone' => '09171234567',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery_type' => 'standard',
        ]);
        $inventory = app(InventoryService::class);

        $this->assertNull($inventory->availablePortions((string) $product->id, (string) $branch->id));
        $inventory->deductForOrder($order);
        $inventory->deductForOrder($order);
        $this->assertDatabaseHas('branch_order_ingredient_deductions', [
            'order_id' => $order->id,
            'branch_id' => $branch->id,
            'ingredient_id' => $ingredient->id,
            'movement_id' => null,
            'is_reversed' => false,
        ]);
        $this->assertDatabaseCount('stock_movements', 0);

        $inventory->reverseOrder($order);
        $inventory->reverseOrder($order);
        $this->assertDatabaseHas('branch_order_ingredient_deductions', [
            'order_id' => $order->id,
            'ingredient_id' => $ingredient->id,
            'is_reversed' => true,
        ]);
    }

    public function test_fulfilling_a_restock_request_records_both_branch_movements_atomically(): void
    {
        $headers = $this->adminHeaders();
        $main = Franchise::create([
            'name' => 'Main Transfer Branch',
            'status' => 'active',
            'is_active' => true,
            'is_main' => true,
        ]);
        $branch = $this->branch('Restock Destination');
        $ingredient = $this->ingredient('Transfer rice');
        $ingredient->update(['quantity' => 10]);
        $restockRequest = InventoryRestockRequest::create([
            'branch_id' => $branch->id,
            'status' => 'pending',
        ]);
        InventoryRestockRequestItem::create([
            'request_id' => $restockRequest->id,
            'ingredient_id' => $ingredient->id,
            'requested_quantity' => 3,
        ]);

        $this->postJson('/api/admin/inventory/transfers', [
            'branch_id' => $branch->id,
            'request_id' => $restockRequest->id,
            'items' => [['ingredient_id' => $ingredient->id, 'quantity' => 3]],
        ], $headers)->assertCreated()
            ->assertJsonPath('data.status', 'received');

        $this->assertDatabaseHas('main_branch_ingredients', ['id' => $ingredient->id, 'quantity' => 7]);
        $this->assertDatabaseHas('branch_ingredient_stocks', ['branch_id' => $branch->id, 'ingredient_id' => $ingredient->id, 'quantity' => 3]);
        $this->assertDatabaseHas('inventory_restock_requests', ['id' => $restockRequest->id, 'status' => 'fulfilled']);
        $this->assertSame(2, DB::table('stock_movements')->where('ingredient_id', $ingredient->id)->count());
    }
}

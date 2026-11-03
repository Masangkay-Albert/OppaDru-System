<?php

namespace Tests\Feature;

use App\Models\AddonGroup;
use App\Models\Franchise;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_product_delete_hides_product_without_breaking_existing_references(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ])->assertOk();

        $product = Product::create([
            'name' => 'Passion Fruit Soda',
            'description' => 'Fruity drink',
            'price' => 89,
            'category' => 'fruity-soda-milk',
            'image' => 'passionfruit-soda.jpg',
            'is_available' => true,
        ]);
        $group = AddonGroup::create([
            'name' => 'Drink options',
            'selection_type' => 'single',
            'supports_quantity' => false,
            'applicable_categories' => ['fruity-soda-milk'],
            'is_active' => true,
        ]);
        $product->addonGroups()->attach($group->id);
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->deleteJson('/api/admin/products/'.$product->id, [], $headers)->assertOk();

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertDatabaseHas('product_addon_groups', [
            'product_id' => $product->id,
            'addon_group_id' => $group->id,
        ]);
        $this->getJson('/api/products/available')->assertOk()->assertJsonMissing(['id' => $product->id]);
        $this->getJson('/api/admin/products', $headers)->assertOk()->assertJsonMissing(['id' => $product->id]);
        $this->assertSame(1, DB::table('product_addon_groups')->where('product_id', $product->id)->count());
    }

    public function test_admin_products_list_includes_products_from_all_branches(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ])->assertOk();
        $branch = Franchise::create([
            'name' => 'Branch Product Scope',
            'status' => 'active',
        ]);
        $product = Product::create([
            'name' => 'Branch-owned admin listing product',
            'description' => 'Visible in the admin catalog',
            'price' => 100,
            'category' => 'chicken',
            'franchise_id' => $branch->id,
            'image' => '',
            'is_available' => true,
        ]);
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->getJson('/api/admin/products', $headers)
            ->assertOk()
            ->assertJsonFragment(['id' => $product->id]);
    }

    public function test_admin_can_create_and_change_product_ownership_scope(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];
        $cavite = Franchise::create(['name' => 'Cavite Scope Branch', 'status' => 'active']);
        $bulacan = Franchise::create(['name' => 'Bulacan Scope Branch', 'status' => 'active']);
        $basePayload = [
            'name' => 'Scoped Apple',
            'description' => 'Branch-owned test item',
            'price' => 120,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ];

        $caviteProduct = $this->postJson('/api/admin/products', [
            ...$basePayload,
            'franchise_id' => $cavite->id,
        ], $headers)->assertCreated()->json('product');
        $bulacanProduct = $this->postJson('/api/admin/products', [
            ...$basePayload,
            'franchise_id' => $bulacan->id,
        ], $headers)->assertCreated()->json('product');

        $this->assertNotSame($caviteProduct['id'], $bulacanProduct['id']);
        $this->assertSame($cavite->id, $caviteProduct['franchise_id']);
        $this->assertSame($bulacan->id, $bulacanProduct['franchise_id']);
        $this->putJson('/api/admin/products/'.$caviteProduct['id'], [
            'franchise_id' => null,
        ], $headers)->assertOk()->assertJsonPath('product.franchise_id', null);

        $this->getJson('/api/admin/products', $headers)
            ->assertOk()
            ->assertJsonFragment(['id' => $caviteProduct['id'], 'franchise_id' => null])
            ->assertJsonFragment(['id' => $bulacanProduct['id'], 'franchise_id' => $bulacan->id]);
    }

    public function test_archiving_hides_product_from_customer_catalog_and_admin_can_restore_it(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ])->assertOk();

        $product = Product::create([
            'name' => 'Archived menu item',
            'description' => 'Temporarily unavailable',
            'price' => 129,
            'category' => 'chicken',
            'image' => 'archived-menu-item.jpg',
            'is_available' => true,
        ]);
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->patchJson('/api/admin/products/'.$product->id.'/archive', [], $headers)->assertOk();
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->getJson('/api/products/available')->assertOk()->assertJsonMissing(['id' => $product->id]);
        $this->getJson('/api/admin/products', $headers)->assertOk()->assertJsonMissing(['id' => $product->id]);
        $this->getJson('/api/admin/products/archived', $headers)->assertOk()->assertJsonFragment(['id' => $product->id]);

        $this->patchJson('/api/admin/products/'.$product->id.'/restore', [], $headers)->assertOk();
        $this->assertNotSoftDeleted('products', ['id' => $product->id]);
        $this->getJson('/api/products/available')->assertOk()->assertJsonFragment(['id' => $product->id]);
    }

    public function test_admin_can_permanently_delete_a_product_from_the_archived_list(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ])->assertOk();

        $product = Product::create([
            'name' => 'Archived drink to delete',
            'description' => 'No longer offered',
            'price' => 89,
            'category' => 'fruity-soda-milk',
            'image' => 'archived-drink.jpg',
            'is_available' => true,
        ]);
        $group = AddonGroup::create([
            'name' => 'Archived drink options',
            'selection_type' => 'single',
            'supports_quantity' => false,
            'applicable_categories' => ['fruity-soda-milk'],
            'is_active' => true,
        ]);
        $product->addonGroups()->attach($group->id);
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->patchJson('/api/admin/products/'.$product->id.'/archive', [], $headers)->assertOk();
        $this->deleteJson('/api/admin/products/'.$product->id, [], $headers)
            ->assertOk()
            ->assertJsonPath('message', 'Archived product permanently deleted.');

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
        $this->assertDatabaseMissing('product_addon_groups', ['product_id' => $product->id]);
    }
}

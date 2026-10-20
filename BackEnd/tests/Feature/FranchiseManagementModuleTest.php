<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FranchiseManagementModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_franchise_account_locations_and_assigned_managers(): void
    {
        $adminToken = $this->createAdminToken();
        $menuItem = Product::create([
            'name' => 'Account Location Menu Item',
            'description' => 'Shared menu item',
            'price' => 120,
            'category' => 'rice',
            'image' => '',
            'is_available' => true,
        ]);
        $coordinates = [
            'latitude' => fake()->randomFloat(7, 4, 22),
            'longitude' => fake()->randomFloat(7, 116, 127),
        ];

        $accountResponse = $this->postJson('/api/admin/franchise-accounts', [
            'name' => 'Northstar Foods',
            'email' => 'office@northstar.test',
            'status' => 'active',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertCreated();
        $accountId = $accountResponse->json('data.id');

        $locationResponse = $this->postJson('/api/admin/franchise-accounts/'.$accountId.'/locations', [
            'name' => 'Northstar Downtown',
            'address' => '1 Main Street',
            'status' => 'active',
            ...$coordinates,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
        ], ['Authorization' => 'Bearer '.$adminToken])->assertCreated();
        $locationId = $locationResponse->json('data.id');
        $savedLocation = Franchise::findOrFail($locationId);
        $this->assertEqualsWithDelta($coordinates['latitude'], (float) $savedLocation->latitude, 0.0000001);
        $this->assertEqualsWithDelta($coordinates['longitude'], (float) $savedLocation->longitude, 0.0000001);
        $this->assertTrue($savedLocation->delivery_enabled);

        $this->assertDatabaseHas('franchises', [
            'id' => $locationId,
            'franchise_account_id' => $accountId,
        ]);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $locationId,
            'product_id' => $menuItem->id,
            'is_available' => true,
        ]);

        $managerResponse = $this->postJson('/api/admin/franchise-accounts/'.$accountId.'/managers', [
            'franchise_id' => $locationId,
            'full_name' => 'Northstar Manager',
            'email' => 'manager@northstar.test',
            'password' => 'Manager@123',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertCreated();

        $this->assertDatabaseHas('franchise_users', [
            'id' => $managerResponse->json('data.id'),
            'franchise_account_id' => $accountId,
            'franchise_id' => $locationId,
        ]);

        Order::create([
            'franchise_id' => $locationId,
            'email' => 'northstar.customer@test',
            'phone' => '09170000020',
            'items' => [],
            'total' => 120,
            'delivery_type' => 'onsite',
            'delivery_address' => 'Onsite - Takeout',
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'status' => 'completed',
        ]);

        $this->getJson('/api/admin/franchise-accounts/'.$accountId, [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk()
            ->assertJsonPath('data.account.id', $accountId)
            ->assertJsonPath('data.locations.0.id', $locationId)
            ->assertJsonPath('data.managers.0.email', 'manager@northstar.test');

        $this->getJson('/api/admin/franchise-accounts', [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk()
            ->assertJsonPath('data.0.total_orders', 1)
            ->assertJsonPath('data.0.total_sales', 120)
            ->assertJsonPath('recent_activity.0.franchise_account_id', $accountId)
            ->assertJsonPath('recent_activity.0.location_name', 'Northstar Downtown');
    }

    public function test_franchise_manager_sees_only_their_assigned_franchise_and_deactivated_account_is_unavailable(): void
    {
        $adminToken = $this->createAdminToken();
        $account = FranchiseAccount::create([
            'name' => 'Harbor Foods',
            'slug' => 'harbor-foods',
            'status' => 'active',
        ]);
        $location = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Harbor Central',
            'slug' => 'harbor-central',
            'status' => 'active',
        ]);
        $otherAccount = FranchiseAccount::create([
            'name' => 'Hill Foods',
            'slug' => 'hill-foods',
            'status' => 'active',
        ]);
        Franchise::create([
            'franchise_account_id' => $otherAccount->id,
            'name' => 'Hill Market',
            'slug' => 'hill-market',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_account_id' => $account->id,
            'franchise_id' => $location->id,
            'full_name' => 'Harbor Manager',
            'email' => 'harbor.manager@test',
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->getJson('/api/franchise/management', $headers)
            ->assertOk()
            ->assertJsonPath('data.franchise.id', $account->id)
            ->assertJsonPath('data.assigned_location.id', $location->id)
            ->assertJsonCount(1, 'data.locations');

        $this->putJson('/api/admin/franchise-accounts/'.$account->id, [
            'status' => 'inactive',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk();

        $this->getJson('/api/franchises/active')->assertOk()
            ->assertJsonMissing(['id' => $location->id]);
        $this->getJson('/api/products/available?franchise_id='.$location->id)->assertNotFound();
        $this->getJson('/api/franchise/management', $headers)->assertForbidden();
    }

    public function test_conditional_approval_does_not_activate_or_create_franchise_access(): void
    {
        $adminToken = $this->createAdminToken();
        $application = FranchiseApplication::create([
            'franchise_name' => 'Cedar Kitchen',
            'contact_name' => 'Cedar Manager',
            'email' => 'cedar.manager@test',
            'phone' => '09170000001',
            'location' => 'Cedar Avenue',
            'status' => 'submitted',
        ]);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk();

        $this->assertSame('conditionally_approved', $application->fresh()->status);
        $this->assertSame(0, FranchiseAccount::count());
        $this->assertSame(0, Franchise::count());
        $this->assertSame(0, FranchiseUser::count());
    }

    public function test_duplicate_application_is_rejected_and_admin_decision_is_recorded(): void
    {
        $adminToken = $this->createAdminToken();
        $applicantToken = 'franchise-management-applicant-token';
        FranchiseApplicant::create([
            'full_name' => 'Maple Manager',
            'email' => 'maple.manager@test',
            'phone' => '09170000033',
            'password' => Hash::make('Applicant@123'),
            'api_token' => hash('sha256', $applicantToken),
            'email_verified_at' => now(),
        ]);
        $applicantHeaders = ['Authorization' => 'Bearer '.$applicantToken];
        $payload = [
            'franchise_name' => 'Maple Grove Kitchen',
            'contact_name' => 'Maple Manager',
            'email' => 'maple.manager@test',
            'phone' => '09170000033',
            'location' => 'Maple Street',
            'applicant_address' => 'Maple Street, Cebu',
            'business_experience' => 'Five years in retail operations.',
            'investment_capacity' => 2000000,
            'has_proposed_property' => false,
            'opening_timeline' => '6_to_12_months',
            'notes' => 'Interested in a neighborhood branch.',
        ];

        $this->postJson('/api/franchise-applications', $payload, $applicantHeaders)->assertCreated();
        $this->postJson('/api/franchise-applications', $payload, $applicantHeaders)->assertStatus(409);

        $application = FranchiseApplication::firstOrFail();
        $admin = Admin::where('api_token', hash('sha256', $adminToken))->firstOrFail();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
            'admin_notes' => 'Standard review passed.',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk();

        $this->assertSame($admin->id, $application->fresh()->reviewed_by_admin_id);
        $this->assertSame('under_review', $application->fresh()->status);
    }

    public function test_migration_links_existing_locations_and_managers_without_changing_their_ids(): void
    {
        $location = Franchise::create([
            'name' => 'Legacy Branch',
            'slug' => 'legacy-branch',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_id' => $location->id,
            'full_name' => 'Legacy Manager',
            'email' => 'legacy.manager@test',
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
        ]);

        $migration = require database_path('migrations/2026_10_08_000001_create_franchise_accounts_and_link_locations.php');
        $migration->up();
        $accountId = Franchise::findOrFail($location->id)->franchise_account_id;
        $migration->up();

        $this->assertNotEmpty($accountId);
        $this->assertDatabaseHas('franchises', [
            'id' => $location->id,
            'franchise_account_id' => $accountId,
        ]);
        $this->assertDatabaseHas('franchise_users', [
            'id' => $manager->id,
            'franchise_id' => $location->id,
            'franchise_account_id' => $accountId,
        ]);
        $this->assertSame(1, FranchiseAccount::count());
    }

    private function createAdminToken(): string
    {
        $token = 'franchise-management-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-admin@test',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return $token;
    }
}

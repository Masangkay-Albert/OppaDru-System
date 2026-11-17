<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Announcement;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\User;
use App\Services\FacebookService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class AnnouncementDeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_customer_announcements_are_limited_to_the_selected_branch(): void
    {
        $this->freezeAt('2026-11-18 00:00:00');
        $laguna = $this->makeBranch('branch-laguna', 'Laguna');
        $davao = $this->makeBranch('branch-davao', 'Davao');
        $customer = $this->makeCustomer();
        $announcement = $this->makeAnnouncement(
            'announcement-laguna',
            ['customers'],
            [$laguna->id],
        );

        $this->actingAs($customer, 'api')
            ->getJson('/api/customer/announcements?branch_id='.$laguna->id)
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('announcements.0.id', $announcement->id);

        $this->actingAs($customer, 'api')
            ->getJson('/api/customer/announcements?branch_id='.$davao->id)
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'announcements');

        $this->actingAs($customer, 'api')
            ->postJson('/api/customer/announcements/'.$announcement->id.'/read', [
                'branch_id' => $davao->id,
                'read' => true,
            ])
            ->assertNotFound();
    }

    public function test_franchise_announcements_are_limited_to_the_authenticated_branch(): void
    {
        $this->freezeAt('2026-11-18 00:00:00');
        $laguna = $this->makeBranch('branch-laguna', 'Laguna');
        $davao = $this->makeBranch('branch-davao', 'Davao');
        $lagunaUser = $this->makeFranchiseUser($laguna);
        $davaoUser = $this->makeFranchiseUser($davao);
        $announcement = $this->makeAnnouncement(
            'franchise-laguna',
            ['franchise_branches'],
            [$laguna->id],
        );
        $this->makeAnnouncement('customers-only', ['customers'], null);

        $this->withToken('laguna-test-token')
            ->getJson('/api/franchise/announcements')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('announcements.0.id', $announcement->id);

        $this->withToken('davao-test-token')
            ->getJson('/api/franchise/announcements')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'announcements');
    }

    public function test_admin_recipient_settings_are_saved_and_editing_updates_the_same_announcement(): void
    {
        $branch = $this->makeBranch('branch-laguna', 'Laguna');
        Admin::create([
            'full_name' => 'System Administrator',
            'email' => 'recipient-admin@example.test',
            'password' => 'password',
            'api_token' => hash('sha256', 'recipient-admin-token'),
        ]);

        $created = $this->withToken('recipient-admin-token')
            ->postJson('/api/admin/announcements', [
                'title' => 'Draft for Laguna',
                'content' => 'Draft content.',
                'target_audience' => 'customers',
                'target_audiences' => ['customers', 'franchise_branches'],
                'franchise_branch_mode' => 'selected',
                'target_franchise_branches' => [$branch->id],
                'priority' => 'normal',
                'status' => 'draft',
            ])
            ->assertCreated()
            ->json('announcement');

        $this->assertSame(
            ['customers', 'franchise_branches'],
            Announcement::findOrFail($created['id'])->target_audiences,
        );
        $this->assertSame([$branch->id], Announcement::findOrFail($created['id'])->target_franchise_branches);

        $this->withToken('recipient-admin-token')
            ->postJson('/api/admin/announcements/'.$created['id'], [
                'target_audience' => 'customers',
                'target_audiences' => ['customers', 'franchise_branches'],
                'franchise_branch_mode' => 'selected',
                'target_franchise_branches' => [$branch->id],
                'status' => 'published',
                'date_sent' => now()->toIso8601String(),
            ])
            ->assertOk();

        $this->assertSame(1, Announcement::query()->count());
        $this->assertSame(['customers', 'franchise_branches'], Announcement::findOrFail($created['id'])->target_audiences);
        $this->assertSame([$branch->id], Announcement::findOrFail($created['id'])->target_franchise_branches);
    }

    public function test_scheduled_announcements_appear_only_after_the_scheduled_time_and_read_state_is_persisted(): void
    {
        $this->freezeAt('2026-11-18 00:00:00');
        $branch = $this->makeBranch('branch-laguna', 'Laguna');
        $customer = $this->makeCustomer();
        $announcement = $this->makeAnnouncement(
            'scheduled-laguna',
            ['customers'],
            [$branch->id],
            'scheduled',
            ['scheduled_at' => now()->addMinute()],
        );

        $this->actingAs($customer, 'api')
            ->getJson('/api/customer/announcements?branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonCount(0, 'announcements');

        Carbon::setTestNow(now()->addMinutes(2));
        $this->actingAs($customer, 'api')
            ->getJson('/api/customer/announcements?branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('announcements.0.is_read', false);

        $this->actingAs($customer, 'api')
            ->postJson('/api/customer/announcements/'.$announcement->id.'/read', [
                'branch_id' => $branch->id,
                'read' => true,
            ])
            ->assertOk()
            ->assertJsonPath('is_read', true);

        $this->actingAs($customer, 'api')
            ->getJson('/api/customer/announcements?branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonPath('announcements.0.is_read', true);
    }

    public function test_customer_announcement_routes_reject_unauthenticated_and_non_customer_users(): void
    {
        $this->getJson('/api/customer/announcements')->assertUnauthorized();

        $adminUser = User::create([
            'id' => 'admin-user',
            'full_name' => 'Admin User',
            'email' => 'admin-user@example.test',
            'password' => 'password',
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($adminUser, 'api')
            ->getJson('/api/customer/announcements')
            ->assertForbidden();
    }

    public function test_facebook_failure_does_not_prevent_saving_an_in_app_announcement(): void
    {
        $facebookService = Mockery::mock(FacebookService::class);
        $facebookService->shouldReceive('publish')
            ->once()
            ->andThrow(new RuntimeException('Facebook unavailable'));
        $this->app->instance(FacebookService::class, $facebookService);

        $admin = Admin::create([
            'full_name' => 'System Administrator',
            'email' => 'announcement-admin@example.test',
            'password' => 'password',
            'api_token' => hash('sha256', 'announcement-admin-token'),
        ]);

        $response = $this->withToken('announcement-admin-token')
            ->postJson('/api/admin/announcements', [
                'title' => 'In-app announcement',
                'content' => 'The in-app message remains available.',
                'target_audience' => 'customers',
                'target_audiences' => ['customers'],
                'franchise_branch_mode' => 'all',
                'priority' => 'normal',
                'status' => 'published',
                'publish_to_facebook' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('facebook_publish.success', false);

        $this->assertDatabaseHas('announcements', [
            'id' => $response->json('announcement.id'),
            'title' => 'In-app announcement',
        ]);
        $this->assertNotNull($admin->fresh());
    }

    private function freezeAt(string $time): void
    {
        Carbon::setTestNow(Carbon::parse($time, 'UTC'));
    }

    private function makeBranch(string $id, string $name): Franchise
    {
        return Franchise::create([
            'id' => $id,
            'name' => $name,
            'slug' => strtolower($name),
            'status' => 'active',
            'is_active' => true,
        ]);
    }

    private function makeCustomer(): User
    {
        return User::create([
            'id' => 'customer-user',
            'full_name' => 'Customer User',
            'email' => 'customer@example.test',
            'password' => 'password',
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
    }

    private function makeFranchiseUser(Franchise $branch): FranchiseUser
    {
        static $tokenIndex = 0;
        $tokenIndex++;
        $token = $tokenIndex === 1 ? 'laguna-test-token' : 'davao-test-token';

        return FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => $branch->name.' Manager',
            'email' => strtolower($branch->name).'@example.test',
            'password' => 'password',
            'api_token' => hash('sha256', $token),
            'api_token_expires_at' => now()->addHour(),
            'is_active' => true,
        ]);
    }

    private function makeAnnouncement(
        string $id,
        array $audiences,
        ?array $branchIds,
        string $status = 'published',
        array $overrides = [],
    ): Announcement {
        return Announcement::create(array_merge([
            'id' => $id,
            'title' => 'Announcement '.$id,
            'content' => 'Announcement content.',
            'target_audience' => in_array('customers', $audiences, true) ? 'customers' : 'franchise_branches',
            'target_audiences' => $audiences,
            'target_franchise_branches' => $branchIds,
            'priority' => 'normal',
            'status' => $status,
            'date_sent' => $status === 'published' ? now() : null,
        ], $overrides));
    }
}

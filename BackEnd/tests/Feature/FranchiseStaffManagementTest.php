<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FranchiseStaffManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_assign_employee_roles_to_main_system_or_a_franchise_location(): void
    {
        $token = $this->createAdminToken();
        $account = FranchiseAccount::create([
            'name' => 'Pine Foods',
            'slug' => 'pine-foods',
            'status' => 'active',
        ]);
        $location = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Pine Central',
            'slug' => 'pine-central',
            'status' => 'active',
        ]);

        $created = $this->postJson('/api/employees', [
            'fullName' => 'Branch Staff',
            'email' => 'branch.staff@test',
            'password' => 'Staff@123',
            'position' => 'staff',
            'franchise_id' => $location->id,
        ], ['Authorization' => 'Bearer ' . $token])->assertCreated();

        $employeeId = $created->json('id');
        $this->assertDatabaseHas('employees', [
            'id' => $employeeId,
            'franchise_id' => $location->id,
            'position' => 'staff',
        ]);

        $this->putJson('/api/employees/' . $employeeId, [
            'position' => 'cashier',
        ], ['Authorization' => 'Bearer ' . $token])->assertOk()
            ->assertJsonPath('position', 'cashier');

        $this->putJson('/api/employees/' . $employeeId, [
            'franchise_id' => null,
        ], ['Authorization' => 'Bearer ' . $token])->assertOk()
            ->assertJsonPath('franchise_id', null);

        $this->assertDatabaseHas('employees', [
            'id' => $employeeId,
            'franchise_id' => null,
            'position' => 'cashier',
        ]);
    }

    public function test_franchise_manager_can_create_and_manage_only_employees_at_assigned_location(): void
    {
        $account = FranchiseAccount::create([
            'name' => 'Lake Foods',
            'slug' => 'lake-foods',
            'status' => 'active',
        ]);
        $location = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Lake East',
            'slug' => 'lake-east',
            'status' => 'active',
        ]);
        $otherAccount = FranchiseAccount::create([
            'name' => 'Valley Foods',
            'slug' => 'valley-foods',
            'status' => 'active',
        ]);
        $otherLocation = Franchise::create([
            'franchise_account_id' => $otherAccount->id,
            'name' => 'Valley West',
            'slug' => 'valley-west',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_account_id' => $account->id,
            'franchise_id' => $location->id,
            'full_name' => 'Lake Manager',
            'email' => 'lake.manager@test',
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
        ]);
        $otherEmployee = Employee::create([
            'franchise_id' => $otherLocation->id,
            'fullName' => 'Other Staff',
            'email' => 'other.staff@test',
            'password' => Hash::make('Staff@123'),
            'position' => 'staff',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $created = $this->postJson('/api/franchise/users', [
            'name' => 'Lake Cashier',
            'email' => 'lake.cashier@test',
            'password' => 'Cashier@123',
            'role' => 'cashier',
        ], $headers)->assertCreated();

        $this->assertDatabaseHas('employees', [
            'id' => $created->json('data.id'),
            'franchise_id' => $location->id,
            'position' => 'cashier',
        ]);

        $this->postJson('/api/franchise/users', [
            'name' => 'Lake Staff',
            'email' => 'lake.staff@test',
            'password' => 'Staff@123',
            'role' => 'staff',
        ], $headers)->assertCreated();
        $this->assertDatabaseHas('employees', [
            'email' => 'lake.staff@test',
            'franchise_id' => $location->id,
            'position' => 'staff',
        ]);

        $this->patchJson('/api/franchise/users/employee/' . $otherEmployee->id, [
            'is_active' => false,
        ], $headers)->assertNotFound();
        $this->assertDatabaseHas('employees', ['id' => $otherEmployee->id, 'is_active' => true]);

        $this->patchJson('/api/franchise/users/employee/' . $created->json('data.id'), [
            'position' => 'staff',
        ], $headers)->assertOk();
        $this->assertDatabaseHas('employees', [
            'id' => $created->json('data.id'),
            'franchise_id' => $location->id,
            'position' => 'staff',
        ]);
    }

    public function test_cashier_login_and_pos_access_remain_bound_to_assigned_location(): void
    {
        $account = FranchiseAccount::create([
            'name' => 'Garden Foods',
            'slug' => 'garden-foods',
            'status' => 'active',
        ]);
        $location = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Garden North',
            'slug' => 'garden-north',
            'status' => 'active',
        ]);
        $employee = Employee::create([
            'franchise_id' => $location->id,
            'fullName' => 'Garden Cashier',
            'email' => 'garden.cashier@test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/employee/login', [
            'email' => $employee->email,
            'password' => 'Cashier@123',
        ])->assertOk();

        $this->getJson('/api/employee/pos/products?franchise_id=' . $location->id, [
            'Authorization' => 'Bearer ' . $login->json('token'),
        ])->assertOk();
        $this->getJson('/api/employee/pos/products?franchise_id=some-other-location', [
            'Authorization' => 'Bearer ' . $login->json('token'),
        ])->assertForbidden();
    }

    private function createAdminToken(): string
    {
        $token = 'franchise-staff-admin-token';
        Admin::create([
            'full_name' => 'Staff Admin',
            'email' => 'staff-admin@test',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return $token;
    }
}

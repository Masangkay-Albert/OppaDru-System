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

    public function test_main_branch_employee_creation_is_automatic_and_cannot_assign_or_transfer_staff(): void
    {
        $token = $this->createAdminToken();
        $mainBranch = Franchise::create([
            'name' => 'Main Branch',
            'slug' => 'main-branch',
            'status' => 'active',
            'is_main' => true,
        ]);
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

        $this->postJson('/api/employees', [
            'fullName' => 'Branch Staff',
            'email' => 'branch.staff@test',
            'password' => 'Staff@123',
            'position' => 'staff',
            'franchise_id' => $location->id,
        ], ['Authorization' => 'Bearer ' . $token])->assertUnprocessable()
            ->assertJsonValidationErrors('franchise_id');

        $created = $this->postJson('/api/employees', [
            'fullName' => 'Main Branch Staff',
            'email' => 'main.staff@test',
            'password' => 'Staff@123',
            'position' => 'staff',
        ], ['Authorization' => 'Bearer ' . $token])->assertCreated();
        $employeeId = $created->json('id');
        $this->assertDatabaseHas('employees', [
            'id' => $employeeId,
            'franchise_id' => $mainBranch->id,
            'position' => 'staff',
        ]);

        $this->putJson('/api/employees/' . $employeeId, [
            'position' => 'cashier',
        ], ['Authorization' => 'Bearer ' . $token])->assertOk()
            ->assertJsonPath('position', 'cashier');

        $this->putJson('/api/employees/' . $employeeId, [
            'franchise_id' => null,
        ], ['Authorization' => 'Bearer ' . $token])->assertUnprocessable()
            ->assertJsonValidationErrors('franchise_id');

        $this->assertDatabaseHas('employees', [
            'id' => $employeeId,
            'franchise_id' => $mainBranch->id,
            'position' => 'cashier',
        ]);

        $otherEmployee = Employee::create([
            'franchise_id' => $location->id,
            'fullName' => 'Pine Branch Staff',
            'email' => 'pine.staff@test',
            'password' => Hash::make('Staff@123'),
            'position' => 'staff',
            'is_active' => true,
        ]);
        $this->putJson('/api/employees/' . $otherEmployee->id, [
            'is_active' => false,
        ], ['Authorization' => 'Bearer ' . $token])->assertNotFound();
        $this->deleteJson('/api/employees/' . $otherEmployee->id, [], [
            'Authorization' => 'Bearer ' . $token,
        ])->assertNotFound();
        $this->putJson('/api/employees/' . $otherEmployee->id . '/reset-password', [
            'password' => 'NewStaff@123',
        ], ['Authorization' => 'Bearer ' . $token])->assertNotFound();
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

        $this->getJson('/api/franchise/users', $headers)
            ->assertOk()
            ->assertJsonMissing(['email' => 'other.staff@test']);

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
        ], $headers)->assertUnprocessable();

        $this->patchJson('/api/franchise/users/employee/' . $otherEmployee->id, [
            'is_active' => false,
        ], $headers)->assertNotFound();
        $this->assertDatabaseHas('employees', ['id' => $otherEmployee->id, 'is_active' => true]);

        $this->patchJson('/api/franchise/users/employee/' . $created->json('data.id'), [
            'position' => 'staff',
        ], $headers)->assertUnprocessable();
        $this->assertDatabaseHas('employees', [
            'id' => $created->json('data.id'),
            'franchise_id' => $location->id,
            'position' => 'cashier',
        ]);
    }

    public function test_main_franchise_user_can_view_all_employees_but_manage_only_main_branch_staff(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Main Branch',
            'slug' => 'main-branch',
            'status' => 'active',
            'is_main' => true,
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Branch',
            'slug' => 'other-branch',
            'status' => 'active',
        ]);
        $mainUser = FranchiseUser::create([
            'franchise_id' => $mainBranch->id,
            'full_name' => 'Main Owner',
            'email' => 'main.owner@test',
            'password' => Hash::make('Owner@123'),
            'role' => 'owner',
            'is_active' => true,
        ]);
        $mainEmployee = Employee::create([
            'franchise_id' => $mainBranch->id,
            'fullName' => 'Main Staff',
            'email' => 'main.employee@test',
            'password' => Hash::make('Staff@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $otherEmployee = Employee::create([
            'franchise_id' => $otherBranch->id,
            'fullName' => 'Other Staff',
            'email' => 'other.employee@test',
            'password' => Hash::make('Staff@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $mainUser->email,
            'password' => 'Owner@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $this->getJson('/api/franchise/users', $headers)
            ->assertOk()
            ->assertJsonFragment(['id' => $mainEmployee->id, 'branch_name' => $mainBranch->name])
            ->assertJsonFragment(['id' => $otherEmployee->id, 'branch_name' => $otherBranch->name]);

        $this->postJson('/api/franchise/users', [
            'name' => 'New Main Staff',
            'email' => 'new.main.employee@test',
            'password' => 'NewStaff@123',
            'role' => 'cashier',
            'franchise_id' => $otherBranch->id,
        ], $headers)->assertForbidden();
        $created = $this->postJson('/api/franchise/users', [
            'name' => 'New Main Staff',
            'email' => 'new.main.employee@test',
            'password' => 'NewStaff@123',
            'role' => 'cashier',
        ], $headers)->assertCreated();
        $this->assertDatabaseHas('employees', [
            'id' => $created->json('data.id'),
            'franchise_id' => $mainBranch->id,
        ]);

        $this->patchJson('/api/franchise/users/employee/' . $otherEmployee->id, [
            'is_active' => false,
        ], $headers)->assertNotFound();
        $this->deleteJson('/api/franchise/users/employee/' . $otherEmployee->id, [], $headers)
            ->assertNotFound();
        $this->assertDatabaseHas('employees', [
            'id' => $otherEmployee->id,
            'is_active' => true,
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
        ])->assertOk()
            ->assertJsonPath('employee.franchise.name', $location->name);

        $this->getJson('/api/employee/pos/products?franchise_id=' . $location->id, [
            'Authorization' => 'Bearer ' . $login->json('token'),
        ])->assertOk();
        $this->getJson('/api/employee/pos/products?franchise_id=some-other-location', [
            'Authorization' => 'Bearer ' . $login->json('token'),
        ])->assertForbidden();
    }

    public function test_branch_manager_can_reset_and_remove_only_staff_at_their_branch(): void
    {
        $account = FranchiseAccount::create([
            'name' => 'Branch Manager Foods',
            'slug' => 'branch-manager-foods',
            'status' => 'active',
        ]);
        $branch = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Manager Branch',
            'slug' => 'manager-branch',
            'status' => 'active',
        ]);
        $otherAccount = FranchiseAccount::create([
            'name' => 'Other Manager Foods',
            'slug' => 'other-manager-foods',
            'status' => 'active',
        ]);
        $otherBranch = Franchise::create([
            'franchise_account_id' => $otherAccount->id,
            'name' => 'Other Manager Branch',
            'slug' => 'other-manager-branch',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_account_id' => $account->id,
            'franchise_id' => $branch->id,
            'full_name' => 'Branch Manager',
            'email' => 'staff-manager@test',
            'password' => Hash::make('Manager@123'),
            'role' => 'manager',
            'is_active' => true,
        ]);
        $ownDriver = \App\Models\Driver::create([
            'franchise_id' => $branch->id,
            'name' => 'Own Driver',
            'email' => 'own-driver@test',
            'password' => Hash::make('Driver@123'),
            'phone' => '09123456789',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
        $otherDriver = \App\Models\Driver::create([
            'franchise_id' => $otherBranch->id,
            'name' => 'Other Driver',
            'email' => 'other-driver@test',
            'password' => Hash::make('Driver@123'),
            'phone' => '09123456789',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $this->getJson('/api/franchise/users', $headers)
            ->assertOk()
            ->assertJsonMissing(['email' => $otherDriver->email]);

        $this->putJson('/api/franchise/users/driver/' . $otherDriver->id . '/password', [
            'password' => 'NewDriver@123',
        ], $headers)->assertNotFound();
        $this->deleteJson('/api/franchise/users/driver/' . $otherDriver->id, [], $headers)->assertNotFound();
        $this->putJson('/api/franchise/users/driver/' . $ownDriver->id . '/password', [
            'password' => 'NewDriver@123',
        ], $headers)->assertOk();
        $this->assertTrue(Hash::check('NewDriver@123', $ownDriver->fresh()->password));
        $this->assertNull($ownDriver->fresh()->api_token);

        $this->deleteJson('/api/franchise/users/driver/' . $ownDriver->id, [], $headers)->assertOk();
        $this->assertDatabaseMissing('drivers', ['id' => $ownDriver->id]);
    }

    public function test_employee_logout_revokes_the_server_side_token(): void
    {
        $account = FranchiseAccount::create([
            'name' => 'Logout Foods',
            'slug' => 'logout-foods',
            'status' => 'active',
        ]);
        $branch = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Logout Branch',
            'slug' => 'logout-branch',
            'status' => 'active',
        ]);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Kitchen Staff',
            'email' => 'logout-kitchen@test',
            'password' => Hash::make('Staff@123'),
            'position' => 'kitchen staff',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/employee/login', [
            'email' => $employee->email,
            'password' => 'Staff@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $this->postJson('/api/employee/logout', [], $headers)->assertOk();
        $this->getJson('/api/kitchen/orders', $headers)->assertUnauthorized();
        $this->assertNull($employee->fresh()->api_token);
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

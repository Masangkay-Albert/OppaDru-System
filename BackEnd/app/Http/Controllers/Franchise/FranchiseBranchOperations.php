<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

trait FranchiseBranchOperations
{
    public function inventorySummary(Request $request, FranchiseInventoryService $inventoryService)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branchProducts = function () use ($user) {
            return Product::where(function ($query) use ($user) {
                $query->where('franchise_id', $user->franchise_id)
                    ->orWhereNull('franchise_id');
            });
        };

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                'total_products' => $branchProducts()->count(),
                'branch_products' => Product::where('franchise_id', $user->franchise_id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'available_products' => $branchProducts()->where('is_available', true)->count(),
                'unavailable_products' => $branchProducts()->where('is_available', false)->count(),
                'category_breakdown' => $branchProducts()->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'items' => $inventoryService->catalog((string) $user->franchise_id),
                'recent_products' => $branchProducts()->orderBy('created_at', 'desc')->limit(10)->get([
                    'id',
                    'name',
                    'category',
                    'price',
                    'franchise_id',
                    'is_available',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function fulfillmentSummary(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                ...$this->fulfillmentMetrics((string) $user->franchise_id),
            ],
        ]);
    }

    public function branchUsers(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $managerUsers = FranchiseUser::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'full_name', 'email', 'phone', 'is_active', 'created_at'])
            ->map(fn (FranchiseUser $branchUser) => [
                'id' => $branchUser->id,
                'name' => $branchUser->full_name,
                'email' => $branchUser->email,
                'phone' => $branchUser->phone,
                'role' => 'Franchise Manager',
                'status' => $branchUser->is_active ? 'active' : 'inactive',
                'created_at' => $branchUser->created_at,
            ]);
        $employees = Employee::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'franchise_id', 'fullName', 'email', 'position', 'is_active', 'created_at'])
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'phone' => null,
                'role' => str_replace(' ', '_', strtolower($employee->position)),
                'status' => $employee->is_active ? 'active' : 'inactive',
                'user_type' => 'employee',
                'franchise_id' => $employee->franchise_id,
                'created_at' => $employee->created_at,
            ]);
        $drivers = Driver::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'phone', 'isActive', 'created_at'])
            ->map(fn (Driver $driver) => [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'phone' => $driver->phone,
                'role' => 'driver',
                'status' => $driver->isActive ? 'active' : 'inactive',
                'user_type' => 'driver',
                'created_at' => $driver->created_at,
            ]);

        return response()->json(['data' => $managerUsers->concat($employees)->concat($drivers)->sortByDesc('created_at')->values()]);
    }

    public function storeBranchUser(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:cashier,kitchen_staff,staff,driver',
            'vehicle_type' => 'required_if:role,driver|nullable|string|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $email = strtolower(trim((string) $request->email));
        if (FranchiseUser::where('email', $email)->exists()
            || Employee::where('email', $email)->exists()
            || Driver::where('email', $email)->exists()) {
            return response()->json(['message' => 'This email address is already assigned to an account.'], 422);
        }

        if ($request->role === 'driver') {
            $branchUser = Driver::create([
                'franchise_id' => $user->franchise_id,
                'name' => $request->name,
                'email' => $email,
                'phone' => $request->input('phone', ''),
                'password' => (string) $request->password,
                'vehicleType' => $request->vehicle_type,
                'isActive' => true,
            ]);
            $data = [
                'id' => $branchUser->id,
                'franchise_id' => $branchUser->franchise_id,
                'name' => $branchUser->name,
                'email' => $branchUser->email,
                'phone' => $branchUser->phone,
                'role' => 'driver',
                'status' => 'active',
                'user_type' => 'driver',
                'created_at' => $branchUser->created_at,
            ];
        } else {
            $branchUser = Employee::create([
                'franchise_id' => $user->franchise_id,
                'fullName' => $request->name,
                'email' => $email,
                'password' => (string) $request->password,
                'position' => match ($request->role) {
                    'kitchen_staff' => 'kitchen staff',
                    'staff' => 'staff',
                    default => 'cashier',
                },
                'is_active' => true,
            ]);
            $data = [
                'id' => $branchUser->id,
                'franchise_id' => $branchUser->franchise_id,
                'name' => $branchUser->fullName,
                'email' => $branchUser->email,
                'phone' => $request->input('phone'),
                'role' => str_replace(' ', '_', strtolower($branchUser->position)),
                'status' => 'active',
                'user_type' => 'employee',
                'created_at' => $branchUser->created_at,
            ];
        }

        return response()->json(['data' => $data, 'message' => 'Branch staff account created successfully.'], 201);
    }

    public function updateBranchUserStatus(Request $request, string $type, string $id)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }
        $validated = $request->validate(['is_active' => 'required|boolean']);

        if ($type === 'employee') {
            $staff = Employee::where('franchise_id', $user->franchise_id)->findOrFail($id);
            $staff->is_active = $validated['is_active'];
        } elseif ($type === 'driver') {
            $staff = Driver::where('franchise_id', $user->franchise_id)->findOrFail($id);
            $staff->isActive = $validated['is_active'];
        } else {
            return response()->json(['message' => 'Unsupported branch user type.'], 422);
        }
        $staff->save();

        return response()->json(['message' => 'Branch staff status updated.']);
    }

    public function updateBranchEmployee(Request $request, string $id)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $employee = Employee::where('franchise_id', $user->franchise_id)->findOrFail($id);
        $validated = $request->validate([
            'position' => 'sometimes|required|in:cashier,kitchen staff,staff',
            'is_active' => 'sometimes|boolean',
        ]);
        if ($validated === []) {
            return response()->json(['message' => 'Provide a staff role or status to update.'], 422);
        }

        if (array_key_exists('position', $validated)) {
            $employee->position = $validated['position'];
        }
        if (array_key_exists('is_active', $validated)) {
            $employee->is_active = $validated['is_active'];
        }
        $employee->save();

        return response()->json([
            'data' => [
                'id' => $employee->id,
                'franchise_id' => $employee->franchise_id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'role' => str_replace(' ', '_', strtolower($employee->position)),
                'status' => $employee->is_active ? 'active' : 'inactive',
            ],
            'message' => 'Branch staff updated.',
        ]);
    }

    public function branchSettings(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);

        return response()->json([
            'data' => [
                'id' => $franchise->id,
                'name' => $franchise->name,
                'email' => $franchise->email,
                'phone' => $franchise->phone,
                'address' => $franchise->address,
                'status' => $franchise->status,
                'operating_hours' => data_get($franchise->metadata, 'operating_hours'),
            ],
        ]);
    }

    public function updateBranchSettings(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'phone' => 'sometimes|nullable|string|max:50',
            'operating_hours' => 'sometimes|nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);
        if ($request->has('phone')) {
            $franchise->phone = $request->input('phone');
        }
        if ($request->has('operating_hours')) {
            $metadata = $franchise->metadata ?? [];
            $metadata['operating_hours'] = $request->input('operating_hours');
            $franchise->metadata = $metadata;
        }
        $franchise->save();

        return response()->json([
            'data' => [
                'id' => $franchise->id,
                'name' => $franchise->name,
                'email' => $franchise->email,
                'phone' => $franchise->phone,
                'address' => $franchise->address,
                'status' => $franchise->status,
                'operating_hours' => data_get($franchise->metadata, 'operating_hours'),
            ],
            'message' => 'Branch settings updated successfully.',
        ]);
    }

    public function updateInventory(Request $request, string $productId, FranchiseInventoryService $inventoryService)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'stock_quantity' => 'sometimes|nullable|integer|min:0',
            'is_available' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Inventory details are invalid.', 'errors' => $validator->errors()], 422);
        }
        if (! $request->has('stock_quantity') && ! $request->has('is_available')) {
            return response()->json(['message' => 'Provide branch stock or availability to update.'], 422);
        }
        if ($request->has('is_available') && ! in_array(strtolower((string) ($user->role ?: 'owner')), ['owner', 'manager'], true)) {
            return response()->json(['message' => 'Only franchise owners and branch managers can change menu availability.'], 403);
        }

        $inventory = $inventoryService->update(
            (string) $user->franchise_id,
            $productId,
            $request->only(['stock_quantity', 'is_available'])
        );

        return response()->json(['data' => $inventory, 'message' => 'Branch inventory updated.']);
    }

    private function fulfillmentMetrics(string $franchiseId): array
    {
        $orders = fn () => Order::where('franchise_id', $franchiseId);

        return [
            'total_orders' => $orders()->count(),
            'pending_orders' => $orders()->where('status', 'pending')->count(),
            'preparing_orders' => $orders()->whereIn('status', ['confirmed', 'preparing'])->count(),
            'prepared_orders' => $orders()->where('status', 'prepared')->count(),
            'ready_orders' => $orders()->where('status', 'ready')->count(),
            'delivered_orders' => $orders()->whereIn('status', ['delivered', 'completed'])->count(),
            'cancelled_orders' => $orders()->where('status', 'cancelled')->count(),
            'average_order_value' => (float) $orders()->countedAsRevenue()->avg('total'),
            'latest_orders' => $orders()->orderByDesc('created_at')->limit(10)->get([
                'id',
                'order_number',
                'status',
                'total',
                'delivery_address',
                'created_at',
            ]),
        ];
    }
}

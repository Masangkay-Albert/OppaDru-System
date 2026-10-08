<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FranchiseAccountController extends Controller
{
    use AdminAuthTrait;

    public function index(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $accounts = FranchiseAccount::query()
            ->withCount(['locations', 'managers'])
            ->with(['locations:id,franchise_account_id,name,address,status'])
            ->orderByDesc('created_at')
            ->get();

        $locationIdsByAccount = $accounts->mapWithKeys(fn (FranchiseAccount $account) => [
            $account->id => $account->locations->pluck('id'),
        ]);
        $accountByLocation = $locationIdsByAccount
            ->flatMap(fn ($locationIds, $accountId) => $locationIds->mapWithKeys(
                fn ($locationId) => [$locationId => $accountId]
            ));
        $allLocationIds = $accountByLocation->keys();

        $orderCounts = Order::whereIn('franchise_id', $allLocationIds)
            ->selectRaw('franchise_id, COUNT(*) as total_orders')
            ->groupBy('franchise_id')
            ->pluck('total_orders', 'franchise_id');
        $salesByLocation = Order::whereIn('franchise_id', $allLocationIds)
            ->countedAsRevenue()
            ->selectRaw('franchise_id, SUM(total) as total_sales')
            ->groupBy('franchise_id')
            ->pluck('total_sales', 'franchise_id');
        $recentActivity = Order::whereIn('franchise_id', $allLocationIds)
            ->with('franchise:id,name,franchise_account_id')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get(['id', 'franchise_id', 'order_number', 'total', 'status', 'created_at'])
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'franchise_id' => $order->franchise_id,
                'franchise_account_id' => $accountByLocation->get($order->franchise_id),
                'franchise_name' => $accounts->firstWhere('id', $accountByLocation->get($order->franchise_id))?->name,
                'location_name' => $order->franchise?->name,
                'total' => (float) $order->total,
                'status' => $order->status,
                'created_at' => $order->created_at,
            ]);

        $accounts->each(function (FranchiseAccount $account) use ($locationIdsByAccount, $orderCounts, $salesByLocation) {
            $locationIds = $locationIdsByAccount->get($account->id, collect());
            $account->setAttribute('total_orders', (int) $locationIds->sum(fn ($id) => (int) $orderCounts->get($id, 0)));
            $account->setAttribute('total_sales', (float) $locationIds->sum(fn ($id) => (float) $salesByLocation->get($id, 0)));
        });

        return response()->json([
            'data' => $accounts,
            'recent_activity' => $recentActivity,
        ]);
    }

    public function store(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:2000',
            'status' => 'nullable|string|in:active,inactive,pending',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The franchise details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $name = trim((string) $request->input('name'));
        $baseSlug = Str::slug($name) ?: 'franchise';
        $slug = $baseSlug;
        while (FranchiseAccount::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.strtolower(Str::random(5));
        }

        $account = FranchiseAccount::create([
            'name' => $name,
            'slug' => $slug,
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'address' => $request->input('address'),
            'status' => $request->input('status', 'active'),
            'owner_admin_id' => null,
        ]);

        return response()->json(['data' => $account->load('locations')], 201);
    }

    public function show(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $account = FranchiseAccount::with([
            'locations' => fn ($query) => $query->orderBy('name'),
            'managers' => fn ($query) => $query->orderBy('full_name'),
        ])->findOrFail($id);
        $locationIds = $account->locations->pluck('id');

        $staff = Employee::whereIn('franchise_id', $locationIds)
            ->orderBy('fullName')
            ->get(['id', 'franchise_id', 'fullName', 'email', 'position', 'is_active'])
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'franchise_id' => $employee->franchise_id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'role' => str_replace(' ', '_', strtolower($employee->position)),
                'is_active' => $employee->is_active,
            ]);
        $drivers = Driver::whereIn('franchise_id', $locationIds)
            ->orderBy('name')
            ->get(['id', 'franchise_id', 'name', 'email', 'phone', 'isActive'])
            ->map(fn (Driver $driver) => [
                'id' => $driver->id,
                'franchise_id' => $driver->franchise_id,
                'name' => $driver->name,
                'email' => $driver->email,
                'role' => 'driver',
                'is_active' => $driver->isActive,
            ]);

        $orders = Order::whereIn('franchise_id', $locationIds);
        $revenueOrders = Order::whereIn('franchise_id', $locationIds)->countedAsRevenue();
        $locationPerformance = $account->locations->map(function (Franchise $location) {
            $locationOrders = Order::where('franchise_id', $location->id);

            return [
                'franchise_id' => $location->id,
                'location_name' => $location->name,
                'total_orders' => (clone $locationOrders)->count(),
                'total_sales' => (float) (clone $locationOrders)->countedAsRevenue()->sum('total'),
                'inventory_items' => DB::table('franchise_inventory')->where('franchise_id', $location->id)->count(),
            ];
        });

        return response()->json([
            'data' => [
                'account' => $account,
                'locations' => $account->locations,
                'managers' => $account->managers,
                'staff' => $staff->concat($drivers)->values(),
                'performance' => [
                    'total_locations' => $account->locations->count(),
                    'total_managers' => $account->managers->count(),
                    'total_staff' => $staff->count() + $drivers->count(),
                    'total_orders' => $orders->count(),
                    'total_sales' => (float) $revenueOrders->sum('total'),
                    'average_order_value' => (float) $revenueOrders->avg('total'),
                    'locations' => $locationPerformance,
                ],
            ],
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $account = FranchiseAccount::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|nullable|string|email|max:255',
            'phone' => 'sometimes|nullable|string|max:50',
            'address' => 'sometimes|nullable|string|max:2000',
            'status' => 'sometimes|required|string|in:active,inactive,pending',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The franchise details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $account->fill($request->only(['name', 'email', 'phone', 'address', 'status']));
        if ($request->filled('name')) {
            $baseSlug = Str::slug((string) $request->input('name')) ?: 'franchise';
            $slug = $baseSlug;
            while (FranchiseAccount::where('slug', $slug)->where('id', '!=', $account->id)->exists()) {
                $slug = $baseSlug.'-'.strtolower(Str::random(5));
            }
            $account->slug = $slug;
        }
        $account->save();

        return response()->json(['data' => $account->load('locations')]);
    }

    public function storeLocation(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $account = FranchiseAccount::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:2000',
            'status' => 'nullable|string|in:active,inactive,pending',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The location details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $name = trim((string) $request->input('name'));
        $baseSlug = Str::slug($name) ?: 'location';
        $slug = $baseSlug;
        while (Franchise::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.strtolower(Str::random(5));
        }

        $location = Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => $name,
            'slug' => $slug,
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'address' => $request->input('address'),
            'status' => $request->input('status', 'active'),
        ]);

        return response()->json(['data' => $location], 201);
    }

    public function storeManager(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $account = FranchiseAccount::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'franchise_id' => [
                'required',
                'string',
                Rule::exists('franchises', 'id')->where('franchise_account_id', $account->id),
            ],
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:franchise_users,email|unique:employees,email|unique:drivers,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8',
            'can_process_pos' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The manager details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $manager = FranchiseUser::create([
            'franchise_account_id' => $account->id,
            'franchise_id' => $request->input('franchise_id'),
            'full_name' => trim((string) $request->input('full_name')),
            'email' => strtolower(trim((string) $request->input('email'))),
            'phone' => $request->input('phone'),
            'password' => Hash::make((string) $request->input('password')),
            'is_active' => true,
            'can_process_pos' => $request->boolean('can_process_pos'),
        ]);

        return response()->json(['data' => $manager->makeHidden(['password', 'api_token'])], 201);
    }
}

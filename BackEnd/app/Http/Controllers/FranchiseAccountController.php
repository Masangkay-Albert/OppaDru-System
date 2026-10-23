<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Services\BranchRoutingService;
use App\Services\FranchiseInventoryService;
use App\Services\GeocodingService;
use App\Traits\AdminAuthTrait;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        $mainBranch = Franchise::query()
            ->where('is_main', true)
            ->first();

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
            'main_branch' => $mainBranch,
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

    public function report(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->query(), [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'locationId' => ['nullable', 'string', 'max:100'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The report filters are invalid.', 'errors' => $validator->errors()], 422);
        }

        $account = FranchiseAccount::with('locations:id,franchise_account_id,name')->findOrFail($id);
        $today = CarbonImmutable::now('Asia/Manila');
        $from = $request->query('from')
            ? CarbonImmutable::createFromFormat('!Y-m-d', (string) $request->query('from'), 'Asia/Manila')
            : $today->startOfMonth();
        $to = $request->query('to')
            ? CarbonImmutable::createFromFormat('!Y-m-d', (string) $request->query('to'), 'Asia/Manila')
            : $today->endOfMonth();

        if ($from->gt($to) || $from->diffInDays($to) > 365) {
            return response()->json(['message' => 'Choose a valid report range of up to 366 days.'], 422);
        }

        $locationIds = $account->locations->pluck('id');
        $locationId = $request->query('locationId');
        if ($locationId && ! $locationIds->contains($locationId)) {
            return response()->json(['message' => 'The selected location does not belong to this franchise.'], 404);
        }

        $cacheKey = 'admin_franchise_report:'.hash('sha256', implode('|', [
            $id, $from->toDateString(), $to->toDateString(), (string) ($locationId ?: 'all'),
        ]));

        $data = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($from, $to, $locationIds, $locationId) {
            $days = $from->diffInDays($to) + 1;
            $previousFrom = $from->subDays($days);
            $previousTo = $from->subDay();
            $start = $from->startOfDay()->utc();
            $end = $to->endOfDay()->utc();
            $previousStart = $previousFrom->startOfDay()->utc();
            $previousEnd = $previousTo->endOfDay()->utc();
            $rangeQuery = static fn ($query, $startDate, $endDate) => $query
                ->whereIn('orders.franchise_id', $locationIds)
                ->when($locationId, fn ($builder) => $builder->where('orders.franchise_id', $locationId))
                ->whereBetween('orders.created_at', [$startDate, $endDate]);
            $summaryFor = static function ($query): array {
                $allStatuses = (clone $query)->selectRaw('LOWER(orders.status) as status, COUNT(*) as count')
                    ->groupByRaw('LOWER(orders.status)')->pluck('count', 'status');
                $revenue = (clone $query)->countedAsRevenue()->selectRaw(
                    'COUNT(*) as orders, COALESCE(SUM(total), 0) as sales, '.
                    'COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(promo_discount, 0)), 0) as discounts, '.
                    'COALESCE(SUM(COALESCE(vat, 0)), 0) as vat'
                )->first();
                $sales = (float) $revenue->sales;
                $discounts = (float) $revenue->discounts;

                return [
                    'total_orders' => (int) (clone $query)->count(),
                    'total_sales' => $sales,
                    'net_sales' => max(0, $sales - $discounts),
                    'average_order_value' => (int) $revenue->orders > 0 ? $sales / (int) $revenue->orders : 0,
                    'completed_orders' => (int) ($allStatuses->get('delivered', 0) + $allStatuses->get('completed', 0)),
                    'cancelled_orders' => (int) $allStatuses->get('cancelled', 0),
                    'discounts' => $discounts,
                    'senior_discount' => (float) (clone $query)->countedAsRevenue()->whereRaw("LOWER(COALESCE(discount_type, '')) LIKE ?", ['%senior%'])->sum('discount_amount'),
                    'pwd_discount' => (float) (clone $query)->countedAsRevenue()->whereRaw("LOWER(COALESCE(discount_type, '')) LIKE ?", ['%pwd%'])->sum('discount_amount'),
                    'promo_discount' => (float) (clone $query)->countedAsRevenue()->sum('promo_discount'),
                    'vat_collected' => (float) $revenue->vat,
                ];
            };
            $current = $rangeQuery(Order::query(), $start, $end);
            $previous = $rangeQuery(Order::query(), $previousStart, $previousEnd);
            $summary = $summaryFor($current);
            $previousSummary = $summaryFor($previous);
            $driver = DB::connection()->getDriverName();
            $dayExpression = match ($driver) {
                'mysql', 'mariadb' => "DATE(CONVERT_TZ(orders.created_at, '+00:00', '+08:00'))",
                'pgsql' => "DATE(orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')",
                'sqlsrv' => 'CONVERT(date, DATEADD(hour, 8, orders.created_at))',
                default => "DATE(orders.created_at, '+8 hours')",
            };
            $hourExpression = match ($driver) {
                'mysql', 'mariadb' => "HOUR(CONVERT_TZ(orders.created_at, '+00:00', '+08:00'))",
                'pgsql' => "EXTRACT(HOUR FROM (orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'))",
                'sqlsrv' => 'DATEPART(hour, DATEADD(hour, 8, orders.created_at))',
                default => "CAST(strftime('%H', orders.created_at, '+8 hours') AS INTEGER)",
            };
            $seriesExpression = $days === 1 ? $hourExpression : $dayExpression;
            $salesSeries = (clone $current)->countedAsRevenue()
                ->selectRaw("{$seriesExpression} as period, COUNT(*) as orders, COALESCE(SUM(orders.total), 0) as sales")
                ->groupByRaw($seriesExpression)->orderBy('period')->get()
                ->map(fn ($row) => ['period' => (string) $row->period, 'orders' => (int) $row->orders, 'sales' => (float) $row->sales]);
            $statuses = (clone $current)->selectRaw('LOWER(orders.status) as status, COUNT(*) as count')
                ->groupByRaw('LOWER(orders.status)')->get()
                ->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count]);
            $paymentMix = (clone $current)->countedAsRevenue()
                ->selectRaw('LOWER(orders.payment_method) as method, COUNT(*) as count, COALESCE(SUM(orders.total), 0) as sales')
                ->groupByRaw('LOWER(orders.payment_method)')->get()
                ->map(fn ($row) => ['method' => $row->method, 'count' => (int) $row->count, 'sales' => (float) $row->sales]);
            $typeExpression = "LOWER(COALESCE(NULLIF(orders.fulfillment_type, ''), NULLIF(orders.delivery_type, ''), 'delivery'))";
            $orderTypes = (clone $current)->selectRaw("CASE WHEN {$typeExpression} LIKE '%dine%' OR {$typeExpression} LIKE '%onsite%' THEN 'dine_in' WHEN {$typeExpression} LIKE '%take%' OR {$typeExpression} LIKE '%pickup%' THEN 'takeout' ELSE 'delivery' END as type, COUNT(*) as count")
                ->groupBy('type')->get()
                ->map(fn ($row) => ['type' => $row->type, 'count' => (int) $row->count]);
            $peakHours = (clone $current)->selectRaw("{$hourExpression} as hour, COUNT(*) as orders")
                ->groupByRaw($hourExpression)->orderBy('hour')->get()
                ->map(fn ($row) => ['hour' => (int) $row->hour, 'orders' => (int) $row->orders]);
            $revenueItems = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
                ->whereIn('orders.franchise_id', $locationIds)
                ->when($locationId, fn ($query) => $query->where('orders.franchise_id', $locationId))
                ->whereBetween('orders.created_at', [$start, $end])
                ->whereNotIn('orders.status', ['cancelled', 'failed'])
                ->where(fn ($query) => $query->where('orders.payment_status', 'paid')->orWhere(
                    fn ($cod) => $cod->where('orders.payment_method', 'cash_on_delivery')
                        ->where('orders.status', 'delivered')
                        ->where(fn ($pending) => $pending->whereNull('orders.payment_status')->orWhereIn('orders.payment_status', ['pending', 'unpaid']))
                ));
            $topProducts = (clone $revenueItems)
                ->selectRaw("order_items.product_id, order_items.product_name as name, COALESCE(products.category, 'Uncategorized') as category, SUM(order_items.quantity) as units_sold, SUM(order_items.quantity * order_items.product_price) as revenue")
                ->groupBy('order_items.product_id', 'order_items.product_name', 'products.category')
                ->orderByDesc('units_sold')->limit(10)->get()
                ->map(fn ($row) => ['product_id' => $row->product_id, 'name' => $row->name, 'category' => $row->category, 'units_sold' => (int) $row->units_sold, 'revenue' => (float) $row->revenue]);
            $salesByLocation = (clone $current)->leftJoin('franchises', 'franchises.id', '=', 'orders.franchise_id')
                ->selectRaw('orders.franchise_id as location_id, franchises.name as location_name, COUNT(*) as orders')
                ->groupBy('orders.franchise_id', 'franchises.name')->orderBy('location_name')->get()
                ->map(function ($row) use ($locationIds, $locationId, $start, $end, $summary) {
                    $orders = Order::query()->where('franchise_id', $row->location_id)->whereBetween('created_at', [$start, $end])->countedAsRevenue();
                    $sales = (float) $orders->sum('total');
                    return [
                        'location_id' => $row->location_id,
                        'location_name' => $row->location_name,
                        'orders' => (int) $row->orders,
                        'sales' => $sales,
                        'average_order_value' => $sales > 0 ? $sales / max(1, (int) $orders->count()) : 0,
                        'share' => $summary['total_sales'] > 0 ? $sales / $summary['total_sales'] * 100 : 0,
                    ];
                });
            $cashierStats = (clone $current)->whereNotNull('orders.cashier_employee_id')
                ->selectRaw('orders.cashier_employee_id as staff_id, COUNT(*) as orders_handled, COALESCE(SUM(orders.total), 0) as sales')
                ->groupBy('orders.cashier_employee_id')->get()->keyBy('staff_id');
            $driverStats = (clone $current)->whereNotNull('orders.driver_id')->where('orders.status', 'delivered')
                ->selectRaw('orders.driver_id as staff_id, COUNT(*) as deliveries_completed')
                ->groupBy('orders.driver_id')->get()->keyBy('staff_id');
            $staffIds = $cashierStats->keys()->merge($driverStats->keys())->unique();
            $staff = Employee::whereIn('id', $staffIds)->get(['id', 'franchise_id', 'fullName', 'email', 'position'])
                ->map(fn (Employee $employee) => [
                    'id' => $employee->id, 'name' => $employee->fullName, 'email' => $employee->email,
                    'role' => $employee->position, 'location_id' => $employee->franchise_id,
                    'orders_handled' => (int) ($cashierStats->get($employee->id)->orders_handled ?? 0),
                    'sales' => (float) ($cashierStats->get($employee->id)->sales ?? 0), 'deliveries_completed' => 0,
                ]);
            $drivers = Driver::whereIn('id', $staffIds)->get(['id', 'franchise_id', 'name', 'email'])
                ->map(fn (Driver $driver) => [
                    'id' => $driver->id, 'name' => $driver->name, 'email' => $driver->email,
                    'role' => 'Driver', 'location_id' => $driver->franchise_id, 'orders_handled' => 0, 'sales' => 0,
                    'deliveries_completed' => (int) ($driverStats->get($driver->id)->deliveries_completed ?? 0),
                ]);
            $recentOrders = (clone $current)->with('franchise:id,name')->orderByDesc('orders.created_at')->limit(10)
                ->get(['orders.id', 'orders.franchise_id', 'orders.order_number', 'orders.email', 'orders.status', 'orders.total', 'orders.payment_method', 'orders.created_at', 'orders.delivery_type', 'orders.fulfillment_type'])
                ->map(fn (Order $order) => [
                    'id' => $order->id, 'location_id' => $order->franchise_id, 'location_name' => $order->franchise?->name,
                    'order_number' => $order->order_number, 'customer' => $order->email,
                    'type' => $order->fulfillment_type ?: $order->delivery_type ?: 'delivery',
                    'total' => (float) $order->total, 'payment_method' => $order->payment_method,
                    'status' => $order->status, 'created_at' => $order->created_at,
                ]);

            return [
                'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'previous_range' => ['from' => $previousFrom->toDateString(), 'to' => $previousTo->toDateString()],
                'summary' => $summary, 'previous' => $previousSummary, 'sales_series' => $salesSeries,
                'statuses' => $statuses, 'payment_mix' => $paymentMix, 'order_types' => $orderTypes,
                'peak_hours' => $peakHours, 'top_products' => $topProducts, 'sales_by_location' => $salesByLocation,
                'staff_performance' => $staff->concat($drivers)->values(), 'recent_orders' => $recentOrders,
                'last_updated' => now()->toIso8601String(),
                'revenue_rules' => 'Revenue includes orders not cancelled or failed that are paid, plus delivered cash-on-delivery orders with pending or unpaid payment status. Total orders include all order statuses.',
            ];
        });

        return response()->json(['data' => $data]);
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

    public function storeLocation(Request $request, string $id, GeocodingService $geocoding)
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
            'latitude' => 'nullable|numeric|between:4,22',
            'longitude' => 'nullable|numeric|between:116,127',
            'is_active' => 'nullable|boolean',
            'accepts_online_orders' => 'nullable|boolean',
            'delivery_enabled' => 'nullable|boolean',
            'delivery_radius_km' => 'nullable|numeric|gt:0|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The location details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $hasLatitude = $request->filled('latitude');
        $hasLongitude = $request->filled('longitude');
        if ($hasLatitude !== $hasLongitude) {
            return response()->json([
                'message' => 'Latitude and longitude must be provided together.',
                'errors' => ['latitude' => ['Enter both latitude and longitude, or leave both blank to geocode the address.']],
            ], 422);
        }

        $latitude = $request->input('latitude');
        $longitude = $request->input('longitude');
        $activeDelivery = $request->boolean('is_active', true)
            && $request->input('status', 'active') === 'active'
            && $request->boolean('delivery_enabled', false);
        $deliveryRadius = $request->filled('delivery_radius_km')
            ? $request->input('delivery_radius_km')
            : config('delivery.default_radius_km');
        if ($activeDelivery && (! is_numeric($deliveryRadius)
            || (float) $deliveryRadius <= 0
            || (float) $deliveryRadius > 100)) {
            return response()->json(['message' => 'Enter a delivery radius greater than zero and no more than 100 km before activating delivery.'], 422);
        }
        if (! $hasLatitude) {
            $geocoded = $geocoding->geocodeAddress((string) $request->input('address', ''));
            if (! $geocoded || ($geocoded['isBroad'] ?? false)) {
                return response()->json([
                    'message' => 'The address only identifies a broad area. Pin the exact branch location or provide a specific street or landmark.',
                    'errors' => ['address' => ['Confirm the exact branch pin before activating delivery.']],
                ], 422);
            }
            $latitude = $geocoded['lat'];
            $longitude = $geocoded['lng'];
        }

        if ($activeDelivery
            && ! app(BranchRoutingService::class)->validBranchCoordinatePair($latitude, $longitude)) {
            return response()->json(['message' => 'Valid Philippine latitude and longitude are required before enabling delivery for an active branch.'], 422);
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
            'is_active' => $request->boolean('is_active', true),
            'accepts_online_orders' => $request->boolean('accepts_online_orders', false),
            'delivery_enabled' => $request->boolean('delivery_enabled', false),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'delivery_radius_km' => $deliveryRadius,
        ]);
        app(FranchiseInventoryService::class)->initializeBranchMenu((string) $location->id);
        $location->refresh();
        if ($location->latitude === null || $location->longitude === null) {
            return response()->json([
                'message' => 'The branch was not saved with coordinates. Please verify the database location columns.',
            ], 500);
        }

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

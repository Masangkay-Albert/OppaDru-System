<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
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
        $companyBranches = Franchise::query()
            ->where('type', 'company')
            ->whereNull('franchise_account_id')
            ->where(function ($query) {
                $query->whereNull('is_main')->orWhere('is_main', false);
            })
            ->withCount('users')
            ->orderBy('name')
            ->get();
        $branchIds = Franchise::query()->pluck('id');
        $companyBranchCount = Franchise::query()->where('type', 'company')->count();
        $franchiseBranchCount = Franchise::query()
            ->where(function ($query) {
                $query->where('type', 'franchise')->orWhereNull('type');
            })
            ->count();
        $activeBranchCount = Franchise::query()
            ->where('status', 'active')
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('franchise_account_id')
                    ->orWhereHas('franchiseAccount', fn ($account) => $account->where('status', 'active'));
            })
            ->count();
        $managerCount = FranchiseUser::query()
            ->whereIn('franchise_id', $branchIds)
            ->count();
        $totalBranchSales = Order::query()
            ->where(function ($query) use ($branchIds) {
                $query->whereIn('branch_id', $branchIds)
                    ->orWhereIn('franchise_id', $branchIds);
            })
            ->countedAsRevenue()
            ->sum('total');

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
            'company_branches' => $companyBranches,
            'branch_counts' => [
                'total' => Franchise::count(),
                'company_owned' => $companyBranchCount,
                'franchise' => $franchiseBranchCount,
                'active' => $activeBranchCount,
                'managers' => $managerCount,
                'sales' => (float) $totalBranchSales,
            ],
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

        $month = CarbonImmutable::now('Asia/Manila');
        $monthStart = $month->startOfMonth()->utc();
        $monthEnd = $month->endOfMonth()->utc();
        $forAccountLocations = static fn ($query) => $query->where(function ($branchQuery) use ($locationIds) {
            $branchQuery->whereIn('branch_id', $locationIds)
                ->orWhere(function ($legacyQuery) use ($locationIds) {
                    $legacyQuery->whereNull('branch_id')->whereIn('franchise_id', $locationIds);
                });
        });
        $orders = $forAccountLocations(Order::query())
            ->whereBetween('created_at', [$monthStart, $monthEnd]);
        $revenueOrders = (clone $orders)->countedAsRevenue();
        $topProduct = $forAccountLocations(Order::query())
            ->countedAsRevenue()
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween('orders.created_at', [$monthStart, $monthEnd])
            ->selectRaw('order_items.product_name as name, SUM(order_items.quantity) as units_sold')
            ->groupBy('order_items.product_name')
            ->orderByDesc('units_sold')
            ->first();
        $locationPerformance = $account->locations->map(function (Franchise $location) use ($forAccountLocations, $monthStart, $monthEnd) {
            $locationOrders = $forAccountLocations(Order::query())
                ->whereBetween('created_at', [$monthStart, $monthEnd])
                ->where(function ($branchQuery) use ($location) {
                    $branchQuery->where('branch_id', $location->id)
                        ->orWhere(function ($legacyQuery) use ($location) {
                            $legacyQuery->whereNull('branch_id')->where('franchise_id', $location->id);
                        });
                });

            return [
                'franchise_id' => $location->id,
                'location_name' => $location->name,
                'total_orders' => (clone $locationOrders)->count(),
                'total_sales' => (float) (clone $locationOrders)->countedAsRevenue()->sum('total'),
            ];
        });
        $locationNames = $account->locations->keyBy('id');
        $recentOrders = $forAccountLocations(Order::query())
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'order_number', 'branch_id', 'franchise_id', 'total', 'status', 'created_at'])
            ->map(function (Order $order) use ($locationNames) {
                $locationId = $order->branch_id ?: $order->franchise_id;

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number ?: $order->id,
                    'location_name' => $locationNames->get($locationId)?->name,
                    'total' => (float) $order->total,
                    'status' => $order->status,
                    'created_at' => $order->created_at,
                ];
            })->values();

        return response()->json([
            'data' => [
                'account' => $account,
                'locations' => $account->locations,
                'managers' => $account->managers,
                'staff' => $staff->concat($drivers)->values(),
                'recent_orders' => $recentOrders,
                'performance' => [
                    'total_locations' => $account->locations->count(),
                    'total_managers' => $account->managers->count(),
                    'total_staff' => $staff->count() + $drivers->count(),
                    'total_orders' => $orders->count(),
                    'total_sales' => (float) $revenueOrders->sum('total'),
                    'average_order_value' => (float) $revenueOrders->avg('total'),
                    'top_product' => $topProduct ? [
                        'name' => $topProduct->name,
                        'units_sold' => (int) $topProduct->units_sold,
                    ] : null,
                    'locations' => $locationPerformance,
                ],
            ],
        ]);
    }

    public function report(Request $request, string $id)
    {
        $response = $this->detailedReport($request, $id);
        if ($response->getStatusCode() !== 200) {
            return $response;
        }

        $payload = $response->getData(true);
        if (! is_array($payload['data'] ?? null)) {
            return $response;
        }

        $data = $payload['data'];
        $summaryFields = [
            'total_orders', 'total_sales', 'net_sales', 'average_order_value', 'completed_orders',
            'cancelled_orders', 'discounts', 'senior_discount', 'pwd_discount', 'promo_discount', 'vat_collected',
        ];
        $locationFields = ['location_id', 'location_name', 'orders', 'sales', 'average_order_value', 'share'];
        $staffFields = ['id', 'name', 'email', 'role', 'location_id', 'orders_handled', 'sales', 'deliveries_completed'];
        $data['summary'] = array_intersect_key($data['summary'] ?? [], array_flip($summaryFields));
        $data['previous'] = array_intersect_key($data['previous'] ?? [], array_flip($summaryFields));
        $data['sales_by_location'] = collect($data['sales_by_location'] ?? [])
            ->filter(fn ($row) => (int) ($row['orders'] ?? 0) > 0)
            ->map(fn ($row) => array_intersect_key($row, array_flip($locationFields)))
            ->values()->all();
        $data['staff_performance'] = collect($data['staff_performance'] ?? [])
            ->map(function ($row) {
                $row['sales'] = (float) ($row['legacy_sales'] ?? $row['sales'] ?? 0);
                unset($row['legacy_sales']);
                return $row;
            })
            ->concat(collect($data['driver_performance'] ?? [])->filter(fn ($row) => (int) ($row['deliveries_completed'] ?? 0) > 0))
            ->map(fn ($row) => array_intersect_key($row, array_flip($staffFields)))
            ->values()->all();
        $data['recent_orders'] = collect($data['recent_orders'] ?? [])
            ->map(function ($row) {
                $row['customer'] = $row['legacy_customer'] ?? $row['customer'] ?? '';
                unset($row['legacy_customer']);
                return $row;
            })->all();

        $responseFields = [
            'range', 'previous_range', 'summary', 'previous', 'sales_series', 'statuses', 'payment_mix',
            'order_types', 'peak_hours', 'top_products', 'sales_by_location', 'staff_performance',
            'recent_orders', 'last_updated', 'revenue_rules',
        ];

        return response()->json(['data' => array_intersect_key($data, array_flip($responseFields))], $response->getStatusCode());
    }

    public function detailedReport(Request $request, string $id)
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

        $data = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($from, $to, $locationIds, $locationId, $account) {
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
                    'refunded_orders' => (int) $allStatuses->get('refunded', 0),
                    'cancelled_refunded_orders' => (int) (clone $query)->where(function ($builder) {
                        $builder->whereIn(DB::raw('LOWER(orders.status)'), ['cancelled', 'refunded'])
                            ->orWhereRaw("LOWER(COALESCE(orders.payment_status, '')) = 'refunded'");
                    })->count(),
                    'cancelled_refunded_order_value' => (float) (clone $query)->where(function ($builder) {
                        $builder->whereIn(DB::raw('LOWER(orders.status)'), ['cancelled', 'refunded'])
                            ->orWhereRaw("LOWER(COALESCE(orders.payment_status, '')) = 'refunded'");
                    })->sum('orders.total'),
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
            $weekdayExpression = match ($driver) {
                'mysql', 'mariadb' => "DAYNAME(CONVERT_TZ(orders.created_at, '+00:00', '+08:00'))",
                'pgsql' => "TO_CHAR(orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'Day')",
                'sqlsrv' => 'DATENAME(weekday, DATEADD(hour, 8, orders.created_at))',
                default => "CASE CAST(strftime('%w', orders.created_at, '+8 hours') AS INTEGER) WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' ELSE 'Saturday' END",
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
            $previousOrderTypes = (clone $previous)->selectRaw("CASE WHEN {$typeExpression} LIKE '%dine%' OR {$typeExpression} LIKE '%onsite%' THEN 'dine_in' WHEN {$typeExpression} LIKE '%take%' OR {$typeExpression} LIKE '%pickup%' THEN 'takeout' ELSE 'delivery' END as type, COUNT(*) as count")
                ->groupBy('type')->get()
                ->map(fn ($row) => ['type' => $row->type, 'count' => (int) $row->count]);
            $peakHours = (clone $current)->selectRaw("{$hourExpression} as hour, COUNT(*) as orders")
                ->groupByRaw($hourExpression)->orderBy('hour')->get()
                ->map(fn ($row) => ['hour' => (int) $row->hour, 'orders' => (int) $row->orders]);
            $ordersByWeekday = (clone $current)->selectRaw("{$weekdayExpression} as day, COUNT(*) as orders")
                ->groupByRaw($weekdayExpression)->orderByDesc('orders')->get()
                ->map(fn ($row) => ['day' => trim((string) $row->day), 'orders' => (int) $row->orders]);
            $revenueItemsFor = static function ($itemStart, $itemEnd) use ($locationIds, $locationId) {
                return Order::query()->countedAsRevenue()
                    ->join('order_items', 'orders.id', '=', 'order_items.order_id')
                    ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
                    ->whereIn('orders.franchise_id', $locationIds)
                    ->when($locationId, fn ($query) => $query->where('orders.franchise_id', $locationId))
                    ->whereBetween('orders.created_at', [$itemStart, $itemEnd]);
            };
            $revenueItems = $revenueItemsFor($start, $end);
            $previousRevenueItems = $revenueItemsFor($previousStart, $previousEnd);
            $topProducts = (clone $revenueItems)
                ->selectRaw("order_items.product_id, order_items.product_name as name, COALESCE(products.category, 'Uncategorized') as category, SUM(order_items.quantity) as units_sold, SUM(order_items.quantity * order_items.product_price) as revenue")
                ->groupBy('order_items.product_id', 'order_items.product_name', 'products.category')
                ->orderByDesc('units_sold')->limit(10)->get()
                ->map(fn ($row) => ['product_id' => $row->product_id, 'name' => $row->name, 'category' => $row->category, 'units_sold' => (int) $row->units_sold, 'revenue' => (float) $row->revenue]);
            $previousTopProduct = (clone $previousRevenueItems)
                ->selectRaw('order_items.product_name as name, SUM(order_items.quantity) as units_sold')
                ->groupBy('order_items.product_name')->orderByDesc('units_sold')->first();
            $categories = (clone $revenueItems)
                ->selectRaw("COALESCE(products.category, 'Uncategorized') as name, SUM(order_items.quantity) as units_sold, SUM(order_items.quantity * order_items.product_price) as sales")
                ->groupBy('products.category')->orderByDesc('sales')->get()
                ->map(fn ($row) => ['name' => $row->name, 'units_sold' => (int) $row->units_sold, 'sales' => (float) $row->sales]);
            $addonRevenueItems = Order::query()->countedAsRevenue()
                ->join('order_items', 'orders.id', '=', 'order_items.order_id')
                ->join('order_item_addons', 'order_item_addons.order_item_id', '=', 'order_items.id')
                ->whereIn('orders.franchise_id', $locationIds)
                ->when($locationId, fn ($query) => $query->where('orders.franchise_id', $locationId))
                ->whereBetween('orders.created_at', [$start, $end]);
            $topAddons = (clone $addonRevenueItems)
                ->selectRaw('order_item_addons.addon_name as name, SUM(order_item_addons.quantity * order_item_addons.unit_price) as sales, SUM(order_item_addons.quantity * order_items.quantity) as units_sold')
                ->groupBy('order_item_addons.addon_name')->orderByDesc('units_sold')->limit(10)->get()
                ->map(fn ($row) => ['name' => $row->name, 'sales' => (float) $row->sales, 'units_sold' => (int) $row->units_sold]);
            $locationOrderStats = (clone $current)
                ->selectRaw("orders.franchise_id, COUNT(*) as orders, SUM(CASE WHEN LOWER(orders.status) IN ('delivered', 'completed') THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN LOWER(orders.status) = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
                ->groupBy('orders.franchise_id')->get()->keyBy('franchise_id');
            $locationRevenueStats = (clone $current)->countedAsRevenue()
                ->selectRaw('orders.franchise_id, COUNT(*) as orders, COALESCE(SUM(orders.total), 0) as sales')
                ->groupBy('orders.franchise_id')->get()->keyBy('franchise_id');
            $salesByLocation = $account->locations
                ->filter(fn ($location) => ! $locationId || (string) $location->id === (string) $locationId)
                ->map(function ($location) use ($locationOrderStats, $locationRevenueStats, $summary) {
                    $orders = $locationOrderStats->get($location->id);
                    $revenue = $locationRevenueStats->get($location->id);
                    $sales = (float) ($revenue->sales ?? 0);
                    $orderCount = (int) ($orders->orders ?? 0);
                    return [
                        'location_id' => $location->id,
                        'location_name' => $location->name,
                        'orders' => $orderCount,
                        'sales' => $sales,
                        'revenue_orders' => (int) ($revenue->orders ?? 0),
                        'average_order_value' => (int) ($revenue->orders ?? 0) > 0 ? $sales / (int) $revenue->orders : 0,
                        'completed_rate' => $orderCount > 0 ? (int) ($orders->completed ?? 0) / $orderCount * 100 : 0,
                        'completed_orders' => (int) ($orders->completed ?? 0),
                        'cancelled' => (int) ($orders->cancelled ?? 0),
                        'share' => $summary['total_sales'] > 0 ? $sales / $summary['total_sales'] * 100 : 0,
                    ];
                })->values();
            $cashierOrderStats = (clone $current)->whereNotNull('orders.cashier_employee_id')
                ->selectRaw('orders.cashier_employee_id as staff_id, COUNT(*) as orders_handled, COALESCE(SUM(orders.total), 0) as total_sales')
                ->groupBy('orders.cashier_employee_id')->get()->keyBy('staff_id');
            $cashierRevenueStats = (clone $current)->countedAsRevenue()->whereNotNull('orders.cashier_employee_id')
                ->selectRaw('orders.cashier_employee_id as staff_id, COALESCE(SUM(orders.total), 0) as sales')
                ->groupBy('orders.cashier_employee_id')->get()->keyBy('staff_id');
            $franchiseUserOrderStats = (clone $current)->whereNotNull('orders.franchise_user_id')
                ->selectRaw('orders.franchise_user_id as staff_id, COUNT(*) as orders_handled')
                ->groupBy('orders.franchise_user_id')->get()->keyBy('staff_id');
            $franchiseUserRevenueStats = (clone $current)->countedAsRevenue()->whereNotNull('orders.franchise_user_id')
                ->selectRaw('orders.franchise_user_id as staff_id, COALESCE(SUM(orders.total), 0) as sales')
                ->groupBy('orders.franchise_user_id')->get()->keyBy('staff_id');
            $driverStats = (clone $current)->whereNotNull('orders.driver_id')->where('orders.status', 'delivered')
                ->selectRaw('orders.driver_id as staff_id, COUNT(*) as deliveries_completed')
                ->groupBy('orders.driver_id')->get()->keyBy('staff_id');
            $driverCancelledStats = (clone $current)->whereNotNull('orders.driver_id')->whereRaw("LOWER(orders.status) = 'cancelled'")
                ->selectRaw('orders.driver_id as staff_id, COUNT(*) as cancelled')
                ->groupBy('orders.driver_id')->get()->keyBy('staff_id');
            $driverDurations = (clone $current)->whereNotNull('orders.driver_id')->where('orders.status', 'delivered')
                ->whereNotNull('orders.delivery_confirmed_at')
                ->get(['orders.driver_id', 'orders.created_at', 'orders.delivery_confirmed_at'])
                ->groupBy('driver_id')->map(function ($orders) {
                    $minutes = $orders->map(fn ($order) => CarbonImmutable::parse($order->created_at)->diffInMinutes(CarbonImmutable::parse($order->delivery_confirmed_at)))
                        ->filter(fn ($duration) => $duration >= 0);
                    return $minutes->isNotEmpty() ? $minutes->avg() : null;
                });
            $staff = Employee::whereIn('id', $cashierOrderStats->keys())->get(['id', 'franchise_id', 'fullName', 'email', 'position'])
                ->map(fn (Employee $employee) => [
                    'id' => $employee->id, 'name' => $employee->fullName, 'email' => $employee->email,
                    'role' => $employee->position, 'location_id' => $employee->franchise_id,
                    'orders_handled' => (int) ($cashierOrderStats->get($employee->id)->orders_handled ?? 0),
                    'sales' => (float) ($cashierRevenueStats->get($employee->id)->sales ?? 0),
                    'legacy_sales' => (float) ($cashierOrderStats->get($employee->id)->total_sales ?? 0),
                    'deliveries_completed' => 0, 'cancelled_deliveries' => 0, 'average_delivery_minutes' => null,
                ]);
            $franchiseUsers = FranchiseUser::whereIn('id', $franchiseUserOrderStats->keys())->get(['id', 'franchise_id', 'full_name', 'email', 'role'])
                ->map(fn (FranchiseUser $user) => [
                    'id' => $user->id, 'name' => $user->full_name, 'email' => $user->email,
                    'role' => $user->role ?: 'Staff', 'location_id' => $user->franchise_id,
                    'orders_handled' => (int) ($franchiseUserOrderStats->get($user->id)->orders_handled ?? 0),
                    'sales' => (float) ($franchiseUserRevenueStats->get($user->id)->sales ?? 0),
                    'deliveries_completed' => 0, 'cancelled_deliveries' => 0, 'average_delivery_minutes' => null,
                ]);
            $driverIds = $driverStats->keys()->merge($driverCancelledStats->keys())->unique();
            $drivers = Driver::whereIn('id', $driverIds)->get(['id', 'franchise_id', 'name', 'email'])
                ->map(fn (Driver $driver) => [
                    'id' => $driver->id, 'name' => $driver->name, 'email' => $driver->email,
                    'role' => 'Driver', 'location_id' => $driver->franchise_id, 'orders_handled' => 0, 'sales' => 0,
                    'deliveries_completed' => (int) ($driverStats->get($driver->id)->deliveries_completed ?? 0),
                    'cancelled_deliveries' => (int) ($driverCancelledStats->get($driver->id)->cancelled ?? 0),
                    'average_delivery_minutes' => $driverDurations->get($driver->id),
                ]);
            $recentOrders = (clone $current)->with(['franchise:id,name', 'user:id,full_name'])->orderByDesc('orders.created_at')->limit(10)
                ->get(['orders.id', 'orders.user_id', 'orders.franchise_id', 'orders.order_number', 'orders.email', 'orders.status', 'orders.total', 'orders.payment_method', 'orders.created_at', 'orders.delivery_type', 'orders.fulfillment_type'])
                ->map(fn (Order $order) => [
                    'id' => $order->id, 'location_id' => $order->franchise_id, 'location_name' => $order->franchise?->name,
                    'order_number' => $order->order_number, 'customer' => $order->user?->full_name ?: $order->email,
                    'legacy_customer' => $order->email,
                    'type' => $order->fulfillment_type ?: $order->delivery_type ?: 'delivery',
                    'total' => (float) $order->total, 'payment_method' => $order->payment_method,
                    'status' => $order->status, 'created_at' => $order->created_at,
                ]);

            return [
                'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'previous_range' => ['from' => $previousFrom->toDateString(), 'to' => $previousTo->toDateString()],
                'summary' => $summary, 'previous' => $previousSummary, 'sales_series' => $salesSeries,
                'statuses' => $statuses, 'payment_mix' => $paymentMix, 'order_types' => $orderTypes,
                'previous_order_types' => $previousOrderTypes,
                'peak_hours' => $peakHours, 'orders_by_weekday' => $ordersByWeekday,
                'top_products' => $topProducts,
                'previous_top_product' => $previousTopProduct ? [
                    'name' => $previousTopProduct->name,
                    'units_sold' => (int) $previousTopProduct->units_sold,
                ] : null,
                'categories' => $categories, 'top_addons' => $topAddons,
                'sales_by_location' => $salesByLocation,
                'staff_performance' => $staff->values(),
                'franchise_user_performance' => $franchiseUsers->values(),
                'driver_performance' => $drivers->values(), 'recent_orders' => $recentOrders,
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
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
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

    public function destroy(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return DB::transaction(function () use ($id) {
            $account = FranchiseAccount::query()->lockForUpdate()->findOrFail($id);
            $hasLocations = $account->locations()->lockForUpdate()->exists();
            $hasManagers = $account->managers()->lockForUpdate()->exists();
            $hasOrders = Order::query()->where('franchise_account_id', $id)->lockForUpdate()->exists();
            $hasApplications = FranchiseApplication::query()
                ->where('franchise_account_id', $id)
                ->lockForUpdate()
                ->exists();

            if ($hasLocations || $hasManagers || $hasOrders || $hasApplications) {
                return response()->json([
                    'message' => 'This franchise has linked locations, managers, orders, or applications and cannot be permanently deleted. Deactivate it instead.',
                ], 409);
            }

            $account->delete();

            return response()->json(['message' => 'Franchise account deleted successfully.']);
        });
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
            'full_name' => [
                'required',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'email' => 'required|string|email|max:'.config('input_limits.email').'|unique:franchise_users,email|unique:employees,email|unique:drivers,email',
            'phone' => ['nullable', 'string', 'max:13', 'regex:'.config('input_limits.phone')],
            'password' => ['required', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max')],
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

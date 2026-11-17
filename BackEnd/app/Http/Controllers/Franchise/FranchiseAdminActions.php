<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use App\Services\BranchRoutingService;
use App\Services\FranchiseInventoryService;
use App\Services\GeocodingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

trait FranchiseAdminActions
{
    public function branchReports(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->query(), [
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The report date range is invalid.', 'errors' => $validator->errors()], 422);
        }

        $query = Order::query()->withoutProofImagePayload()->where('branch_id', $user->franchise_id);
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        $orders = $query->orderByDesc('created_at')->get();
        $completedOrders = $orders->whereIn('status', ['delivered', 'completed']);
        $salesOrders = $orders->filter(fn (Order $order) => $order->isCountedAsRevenue());
        $branch = Franchise::query()->find($user->franchise_id);
        $productSales = [];
        foreach ($salesOrders as $order) {
            foreach (($order->items ?? []) as $item) {
                $key = (string) ($item['product_id'] ?? $item['product_name'] ?? 'unknown');
                if (! isset($productSales[$key])) {
                    $productSales[$key] = [
                        'product_id' => $item['product_id'] ?? null,
                        'product_name' => $item['product_name'] ?? 'Item',
                        'quantity' => 0,
                        'sales' => 0.0,
                    ];
                }
                $quantity = (int) ($item['quantity'] ?? 0);
                $productSales[$key]['quantity'] += $quantity;
                $productSales[$key]['sales'] += (float) ($item['product_price'] ?? 0) * $quantity;
            }
        }

        return response()->json([
            'data' => [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'sales_target_amount' => $branch?->sales_target_amount,
                'total_sales' => (float) $salesOrders->sum('total'),
                'total_orders' => $orders->count(),
                'completed_orders' => $completedOrders->count(),
                'cancelled_orders' => $orders->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $salesOrders->avg('total'),
                'product_sales' => collect(array_values($productSales))->sortByDesc('sales')->values(),
                'payment_summary' => $salesOrders->groupBy('payment_method')->map(fn ($group) => [
                    'orders' => $group->count(),
                    'amount' => (float) $group->sum('total'),
                ]),
                'discount_summary' => [
                    'discounted_orders' => $salesOrders->whereNotNull('discount_type')->count(),
                    'discount_amount' => (float) $salesOrders->sum('discount_amount'),
                ],
            ],
        ]);
    }

    public function updateBranchSalesTarget(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'target_amount' => 'required|numeric|gt:0|max:9999999999.99',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The sales target must be greater than zero.', 'errors' => $validator->errors()], 422);
        }

        $branch = Franchise::query()->findOrFail($user->franchise_id);
        $branch->sales_target_amount = $request->input('target_amount');
        $branch->save();

        return response()->json(['data' => ['target_amount' => $branch->sales_target_amount]]);
    }

    public function deleteBranchSalesTarget(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branch = Franchise::query()->findOrFail($user->franchise_id);
        $branch->sales_target_amount = null;
        $branch->save();

        return response()->json(['data' => null]);
    }

    public function inventoryOverview(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $branchProducts = fn () => Product::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_products' => $branchProducts()->count(),
                'available_products' => $branchProducts()->where('is_available', true)->count(),
                'unavailable_products' => $branchProducts()->where('is_available', false)->count(),
                'category_breakdown' => $branchProducts()->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'recent_products' => $branchProducts()->orderByDesc('created_at')->limit(10)->get([
                    'id',
                    'name',
                    'category',
                    'price',
                    'is_available',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function fulfillmentOverview(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                ...$this->fulfillmentMetrics((string) $franchise->id),
            ],
        ]);
    }

    public function users(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);

        return response()->json(['data' => $franchise->users()->orderBy('created_at', 'desc')->get()]);
    }

    public function storeUser(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);

        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $validator = Validator::make($request->all(), [
            'full_name' => [
                'required',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'email' => 'required|string|email|max:'.config('input_limits.email').'|unique:franchise_users,email',
            'phone' => ['nullable', 'string', 'max:13', 'regex:'.config('input_limits.phone')],
            'password' => ['nullable', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max')],
            'is_active' => 'nullable|boolean',
            'can_process_pos' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $email = strtolower(trim((string) $request->email));
        if ($this->emailUsedByOtherStaff($email)) {
            return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
        }

        $user = FranchiseUser::create([
            'franchise_id' => $franchise->id,
            'full_name' => $request->full_name,
            'email' => $email,
            'phone' => $request->phone,
            'password' => Hash::make((string) $request->input('password', 'Franchise@123')),
            'is_active' => $request->boolean('is_active', true),
            'can_process_pos' => $request->boolean('can_process_pos', false),
        ]);

        return response()->json(['data' => $user->load('franchise')], 201);
    }

    public function updateUser(Request $request, string $id, string $userId)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $user = FranchiseUser::where('franchise_id', $franchise->id)->where('id', $userId)->firstOrFail();

        $requestedName = $request->input('full_name');
        $nameUnchanged = $request->exists('full_name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $user->full_name);
        $requestedEmail = $request->input('email');
        $emailUnchanged = $request->exists('email')
            && is_string($requestedEmail)
            && strcasecmp(trim($requestedEmail), trim((string) $user->email)) === 0;
        $requestedPhone = $request->input('phone');
        $phoneUnchanged = $request->exists('phone')
            && (string) $requestedPhone === (string) $user->phone;
        $nameRules = ['sometimes', 'string'];
        if ($request->exists('full_name') && ! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ];
        }
        $emailRules = ['sometimes', 'string', 'email', 'unique:franchise_users,email,'.$user->id];
        if ($request->exists('email') && ! $emailUnchanged) {
            $emailRules[] = 'max:'.config('input_limits.email');
        }
        $phoneRules = ['sometimes', 'nullable', 'string'];
        if ($request->exists('phone') && ! $phoneUnchanged) {
            $phoneRules = [...$phoneRules, 'max:13', 'regex:'.config('input_limits.phone')];
        }
        if ($request->exists('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        }
        $validator = Validator::make($request->all(), [
            'full_name' => $nameRules,
            'email' => $emailRules,
            'phone' => $phoneRules,
            'password' => ['sometimes', 'nullable', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max')],
            'is_active' => 'sometimes|boolean',
            'can_process_pos' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->filled('email') && ! $emailUnchanged) {
            $email = strtolower(trim((string) $request->email));
            if ($this->emailUsedByOtherStaff($email)) {
                return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
            }
        }

        if ($request->filled('full_name') && ! $nameUnchanged) {
            $user->full_name = $request->full_name;
        }

        if ($request->filled('email') && ! $emailUnchanged) {
            $user->email = strtolower(trim((string) $request->email));
        }

        if ($request->has('phone') && ! $phoneUnchanged) {
            $user->phone = $request->phone;
        }

        if ($request->filled('password')) {
            $user->password = Hash::make((string) $request->password);
            $user->api_token = null;
            $user->api_token_expires_at = null;
        }

        if ($request->has('is_active')) {
            $user->is_active = $request->boolean('is_active');
            if (! $user->is_active) {
                $user->api_token = null;
                $user->api_token_expires_at = null;
            }
        }
        if ($request->has('can_process_pos')) {
            $user->can_process_pos = $request->boolean('can_process_pos');
        }

        $user->save();

        return response()->json(['data' => $user->load('franchise')]);
    }

    public function toggleUserStatus(Request $request, string $id, string $userId)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $user = FranchiseUser::where('franchise_id', $franchise->id)->where('id', $userId)->firstOrFail();

        $validator = Validator::make($request->all(), [
            'is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user->is_active = $request->boolean('is_active');
        if (! $user->is_active) {
            $user->api_token = null;
            $user->api_token_expires_at = null;
        }
        $user->save();

        return response()->json([
            'data' => $user->load('franchise'),
            'message' => 'Franchise user status updated successfully.',
        ]);
    }

    public function store(Request $request, GeocodingService $geocoding)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255', 'unique:franchises,name'],
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'required|string',
            'status' => 'nullable|string|in:active,inactive,pending',
            'type' => 'nullable|string|in:company,franchise',
            'latitude' => 'nullable|numeric|between:4,22',
            'longitude' => 'nullable|numeric|between:116,127',
            'is_active' => 'nullable|boolean',
            'accepts_online_orders' => 'nullable|boolean',
            'delivery_enabled' => 'nullable|boolean',
            'delivery_radius_km' => 'nullable|numeric|gt:0|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $hasLatitude = $request->filled('latitude');
        $hasLongitude = $request->filled('longitude');
        if ($hasLatitude !== $hasLongitude) {
            return response()->json([
                'message' => 'Latitude and longitude must be provided together.',
                'errors' => ['latitude' => ['Enter both coordinates or leave both blank to geocode the address.']],
            ], 422);
        }
        $latitude = $request->input('latitude');
        $longitude = $request->input('longitude');
        $activeDelivery = $request->boolean('is_active', true)
            && $request->input('status', 'active') === 'active'
            && $request->boolean('delivery_enabled', true);
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

        $franchise = Franchise::create([
            'name' => $request->name,
            'slug' => Str::slug($request->name),
            'email' => $request->email,
            'phone' => $request->phone,
            'address' => $request->address,
            'status' => $request->input('status', 'active'),
            'type' => $request->input('type', 'franchise'),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_active' => $request->boolean('is_active', true),
            'accepts_online_orders' => $request->boolean('accepts_online_orders', true),
            'delivery_enabled' => $request->boolean('delivery_enabled', true),
            'delivery_radius_km' => $deliveryRadius,
            'location_status' => $hasLatitude ? 'manual' : 'geocoded',
            'location_error' => null,
            'owner_admin_id' => null,
        ]);

        app(FranchiseInventoryService::class)->initializeBranchMenu((string) $franchise->id);

        return response()->json(['data' => $franchise], 201);
    }

    public function availableCompanyBranchManagers(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $managers = FranchiseUser::query()
            ->with('franchise:id,name')
            ->whereNull('franchise_account_id')
            ->whereNotNull('franchise_id')
            ->whereIn('role', ['owner', 'manager'])
            ->where('is_active', true)
            ->whereHas('franchise', fn ($query) => $query
                ->where('type', 'company')
                ->whereNull('franchise_account_id'))
            ->orderBy('full_name')
            ->get(['id', 'franchise_id', 'full_name', 'email', 'role'])
            ->map(fn (FranchiseUser $manager) => [
                'id' => $manager->id,
                'franchise_id' => $manager->franchise_id,
                'full_name' => $manager->full_name,
                'email' => $manager->email,
                'role' => $manager->role,
                'branch_name' => $manager->franchise?->name,
            ])
            ->values();

        return response()->json(['data' => $managers]);
    }

    public function storeCompanyBranch(Request $request, GeocodingService $geocoding)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $request->merge([
            'name' => trim((string) $request->input('name')),
            'email' => strtolower(trim((string) $request->input('email'))),
            'manager_mode' => $request->input('manager_mode', 'none'),
            'manager_email' => strtolower(trim((string) $request->input('manager_email'))),
        ]);
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (Franchise::query()->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $value))])->exists()) {
                        $fail('A branch with this name already exists.');
                    }
                },
            ],
            'address' => 'required|string|max:2000',
            'delivery_radius_km' => 'required|numeric|gt:0|max:100',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|string|email|max:255',
            'status' => 'required|string|in:active,inactive',
            'latitude' => 'nullable|numeric|between:4,22',
            'longitude' => 'nullable|numeric|between:116,127',
            'location_status' => 'nullable|in:geocoded,manual',
            'manager_mode' => 'required|in:none,existing,create',
            'manager_id' => 'nullable|required_if:manager_mode,existing|string',
            'manager_name' => [
                'nullable',
                'required_if:manager_mode,create',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'manager_email' => 'nullable|required_if:manager_mode,create|string|email|max:'.config('input_limits.email'),
            'manager_password' => [
                'nullable',
                'required_if:manager_mode,create',
                'string',
                'min:'.config('input_limits.password.min'),
                'max:'.config('input_limits.password.max'),
            ],
        ], [
            'delivery_radius_km.gt' => 'Delivery radius must be greater than zero.',
            'manager_id.required_if' => 'Choose an existing manager.',
            'manager_name.required_if' => 'Enter the manager name.',
            'manager_email.required_if' => 'Enter the manager email.',
            'manager_password.required_if' => 'Enter the manager password.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please correct the branch details.',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->input('manager_mode') === 'create') {
            $managerEmail = (string) $request->input('manager_email');
            if (FranchiseUser::query()->whereRaw('LOWER(email) = ?', [$managerEmail])->exists()
                || $this->emailUsedByOtherStaff($managerEmail)) {
                return response()->json([
                    'message' => 'This email is already used by another account.',
                    'errors' => ['manager_email' => ['Use an email address that is not already assigned to another account.']],
                ], 422);
            }
        }

        $hasLatitude = $request->filled('latitude');
        $hasLongitude = $request->filled('longitude');
        if ($hasLatitude !== $hasLongitude) {
            return response()->json([
                'message' => 'Latitude and longitude must be provided together.',
                'errors' => ['address' => ['Pin the branch location on the map or leave both coordinates blank to find it from the address.']],
            ], 422);
        }

        $latitude = $request->input('latitude');
        $longitude = $request->input('longitude');
        $locationStatus = $request->input('location_status', $hasLatitude ? 'manual' : 'geocoded');
        if (! $hasLatitude) {
            $geocoded = $geocoding->geocodeAddress((string) $request->input('address'));
            if (! $geocoded || ($geocoded['isBroad'] ?? false)) {
                return response()->json([
                    'message' => 'The address needs an exact branch location.',
                    'errors' => ['address' => ['Pin the exact branch location on the map or enter a more specific address.']],
                ], 422);
            }
            $latitude = $geocoded['lat'];
            $longitude = $geocoded['lng'];
        }

        if ($request->input('status') === 'active'
            && ! app(BranchRoutingService::class)->validBranchCoordinatePair($latitude, $longitude)) {
            return response()->json([
                'message' => 'A valid map location is required for an active branch.',
                'errors' => ['address' => ['Pin a valid location in the Philippines before creating an active branch.']],
            ], 422);
        }

        $branch = DB::transaction(function () use ($request, $latitude, $longitude, $locationStatus): Franchise {
            if (Franchise::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $request->input('name')))])
                ->lockForUpdate()
                ->exists()) {
                throw ValidationException::withMessages([
                    'name' => ['A branch with this name already exists.'],
                ]);
            }

            $baseSlug = Str::slug((string) $request->input('name')) ?: 'branch';
            $slug = $baseSlug;
            while (Franchise::query()->where('slug', $slug)->exists()) {
                $slug = $baseSlug.'-'.strtolower(Str::random(5));
            }

            $active = $request->input('status') === 'active';
            $branch = Franchise::create([
                'franchise_account_id' => null,
                'name' => (string) $request->input('name'),
                'slug' => $slug,
                'email' => $request->input('email') ?: null,
                'phone' => $request->input('phone') ?: null,
                'address' => (string) $request->input('address'),
                'status' => $active ? 'active' : 'inactive',
                'type' => 'company',
                'is_main' => false,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'is_active' => $active,
                'accepts_online_orders' => true,
                'delivery_enabled' => true,
                'delivery_radius_km' => (float) $request->input('delivery_radius_km'),
                'location_status' => $locationStatus,
                'location_error' => null,
            ]);

            if ($request->input('manager_mode') === 'existing') {
                $manager = FranchiseUser::query()
                    ->whereKey($request->input('manager_id'))
                    ->whereNull('franchise_account_id')
                    ->whereIn('role', ['owner', 'manager'])
                    ->whereHas('franchise', fn ($query) => $query
                        ->where('type', 'company')
                        ->whereNull('franchise_account_id'))
                    ->lockForUpdate()
                    ->first();

                if (! $manager) {
                    throw ValidationException::withMessages([
                        'manager_id' => ['That manager is no longer available. Choose another manager.'],
                    ]);
                }

                $manager->franchise_id = $branch->id;
                $manager->api_token = null;
                $manager->api_token_expires_at = null;
                $manager->save();
            } elseif ($request->input('manager_mode') === 'create') {
                FranchiseUser::create([
                    'franchise_id' => $branch->id,
                    'franchise_account_id' => null,
                    'full_name' => trim((string) $request->input('manager_name')),
                    'email' => (string) $request->input('manager_email'),
                    'password' => Hash::make((string) $request->input('manager_password')),
                    'role' => 'owner',
                    'is_active' => true,
                    'can_process_pos' => false,
                ]);
            }

            app(FranchiseInventoryService::class)->initializeBranchMenu((string) $branch->id);

            return $branch;
        });

        return response()->json(['data' => $branch, 'message' => 'Company-owned branch created.'], 201);
    }

    public function update(Request $request, string $id, GeocodingService $geocoding)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => 'sometimes|nullable|string|email|max:255',
            'phone' => 'sometimes|nullable|string|max:50',
            'address' => 'sometimes|nullable|string',
            'status' => 'sometimes|string|in:active,inactive,pending',
            'type' => 'sometimes|string|in:company,franchise',
            'latitude' => 'sometimes|nullable|numeric|between:4,22',
            'longitude' => 'sometimes|nullable|numeric|between:116,127',
            'is_active' => 'sometimes|boolean',
            'accepts_online_orders' => 'sometimes|boolean',
            'delivery_enabled' => 'sometimes|boolean',
            'delivery_radius_km' => 'sometimes|nullable|numeric|gt:0|max:20',
            'location_status' => 'sometimes|in:geocoded,manual,needs_location',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $hasLatitude = $request->filled('latitude');
        $hasLongitude = $request->filled('longitude');
        if ($hasLatitude !== $hasLongitude) {
            return response()->json([
                'message' => 'Latitude and longitude must be provided together.',
                'errors' => ['latitude' => ['Enter both coordinates or leave both blank to geocode the address.']],
            ], 422);
        }

        $willHaveDelivery = $request->has('delivery_enabled') ? $request->boolean('delivery_enabled') : (bool) $franchise->delivery_enabled;
        $willBeActive = $request->has('is_active') ? $request->boolean('is_active') : (bool) $franchise->is_active;
        $willHaveActiveStatus = $request->input('status', $franchise->status) === 'active';
        $activeDelivery = $willHaveDelivery && $willBeActive && $willHaveActiveStatus;
        $deliveryRadius = $request->has('delivery_radius_km')
            ? $request->input('delivery_radius_km')
            : $franchise->delivery_radius_km;
        if ($activeDelivery && (! is_numeric($deliveryRadius) || (float) $deliveryRadius <= 0 || (float) $deliveryRadius > 100)) {
            return response()->json(['message' => 'Enter a delivery radius greater than zero and no more than 100 km before activating delivery.'], 422);
        }
        $latitude = $hasLatitude ? $request->input('latitude') : $franchise->latitude;
        $longitude = $hasLongitude ? $request->input('longitude') : $franchise->longitude;
        $address = $request->input('address', $franchise->address);
        $addressChanged = $request->has('address') && trim((string) $address) !== trim((string) $franchise->address);
        $geocodedNewCoordinates = false;
        $hasExistingCoordinates = app(BranchRoutingService::class)->validBranchCoordinatePair($franchise->latitude, $franchise->longitude);
        if (! $hasLatitude && ($addressChanged || ! $hasExistingCoordinates)) {
            $geocoded = $geocoding->geocodeAddress((string) $address);
            if (! $geocoded || ($geocoded['isBroad'] ?? false)) {
                return response()->json([
                    'message' => 'The address only identifies a broad area. Pin the exact branch location or provide a specific street or landmark.',
                    'errors' => ['address' => ['Confirm the exact branch pin before activating delivery.']],
                ], 422);
            }
            $latitude = $geocoded['lat'];
            $longitude = $geocoded['lng'];
            $geocodedNewCoordinates = true;
        }
        if ($activeDelivery && ! app(BranchRoutingService::class)->validBranchCoordinatePair($latitude, $longitude)) {
            return response()->json(['message' => 'Valid Philippine latitude and longitude are required before enabling delivery for this branch.'], 422);
        }

        $franchise->fill($request->only([
            'name', 'email', 'phone', 'address', 'status', 'type',
            'delivery_radius_km', 'location_status',
        ]));
        $franchise->latitude = $latitude;
        $franchise->longitude = $longitude;
        if ($request->has('location_status')) {
            $franchise->location_status = $request->input('location_status');
        } elseif ($geocodedNewCoordinates) {
            $franchise->location_status = 'geocoded';
        } elseif ($hasLatitude) {
            $franchise->location_status = 'manual';
        }
        if ($latitude !== null && $longitude !== null) {
            $franchise->location_error = null;
        }
        foreach (['is_active', 'accepts_online_orders', 'delivery_enabled'] as $flag) {
            if ($request->has($flag)) {
                $franchise->{$flag} = $request->boolean($flag);
            }
        }
        if ($request->filled('name') && ! $franchise->is_main) {
            $franchise->slug = Str::slug($request->name);
        }
        $franchise->save();
        $franchise->refresh();
        if ($franchise->latitude === null || $franchise->longitude === null) {
            return response()->json([
                'message' => 'The branch was not saved with coordinates. Please verify the database location columns.',
            ], 500);
        }

        return response()->json(['data' => $franchise]);
    }

    public function destroy(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return DB::transaction(function () use ($id) {
            $franchise = Franchise::query()->lockForUpdate()->findOrFail($id);
            if ($franchise->franchise_account_id) {
                return response()->json([
                    'message' => 'This branch belongs to a franchise account. Delete or manage it through that franchise account instead.',
                ], 409);
            }

            if ($this->hasFranchiseDependencies($id)) {
                return response()->json([
                    'message' => 'This branch has linked orders, staff, inventory, products, or applications and cannot be deleted.',
                ], 409);
            }

            $replacement = null;
            if ($franchise->is_main) {
                $replacement = Franchise::query()
                    ->where('id', '!=', $id)
                    ->orderByRaw("CASE WHEN status = 'active' AND is_active = true THEN 0 ELSE 1 END")
                    ->orderBy('created_at')
                    ->lockForUpdate()
                    ->first();

                if (! $replacement) {
                    return response()->json([
                        'message' => 'At least one other branch must remain before the Main Branch can be deleted.',
                    ], 409);
                }

                $replacement->is_main = true;
                $replacement->save();
            }

            $franchise->delete();

            return response()->json([
                'message' => 'Franchise deleted successfully.',
                'replacement_main_branch_id' => $replacement?->id,
            ]);
        });
    }

    private function hasFranchiseDependencies(string $id): bool
    {
        $tables = [
            'franchise_users',
            'franchise_inventory',
            'employees',
            'drivers',
            'products',
            'addon_groups',
            'addons',
            'system_settings',
            'discount_applications',
            'employee_pos_drafts',
            'franchise_applications',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'franchise_id')
                && DB::table($table)->where('franchise_id', $id)->exists()) {
                return true;
            }
        }

        if (Schema::hasTable('orders')) {
            $hasFranchiseId = Schema::hasColumn('orders', 'franchise_id');
            $hasBranchId = Schema::hasColumn('orders', 'branch_id');
            if (($hasFranchiseId || $hasBranchId) && DB::table('orders')->where(function ($query) use ($id, $hasFranchiseId, $hasBranchId) {
                if ($hasFranchiseId) {
                    $query->where('franchise_id', $id);
                }
                if ($hasBranchId) {
                    $method = $hasFranchiseId ? 'orWhere' : 'where';
                    $query->{$method}('branch_id', $id);
                }
            })->exists()) {
                return true;
            }
        }

        return false;
    }

    private function emailUsedByOtherStaff(string $email): bool
    {
        return \App\Models\Employee::whereRaw('LOWER(email) = ?', [$email])->exists()
            || \App\Models\Driver::whereRaw('LOWER(email) = ?', [$email])->exists();
    }
}

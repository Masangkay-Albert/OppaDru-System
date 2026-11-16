<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\OrderReplacementRequest;
use App\Models\User;
use App\Notifications\ReplacementStatusNotification;
use App\Services\OrderReplacementService;
use App\Support\OrderReplacementPolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

class OrderReplacementController extends Controller
{
    public function __construct(private readonly OrderReplacementService $replacementService) {}

    public function storeCustomerRequest(Request $request, string $orderId)
    {
        $validated = $request->validate([
            'issue_type' => ['required', 'string', Rule::in(OrderReplacementPolicy::ISSUE_TYPES)],
            'item_ids' => ['required', 'array', 'min:1'],
            'item_ids.*' => ['required', 'integer', 'distinct'],
            'description' => [
                'required',
                'string',
                'min:'.config('input_limits.replacement_description.min'),
                'max:'.config('input_limits.replacement_description.max'),
            ],
            'photos' => ['nullable', 'array', 'max:3'],
            'photos.*' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);
        $validated['description'] = trim($validated['description']);
        if (mb_strlen($validated['description']) < (int) config('input_limits.replacement_description.min')) {
            abort(422, 'Description must be at least 3 characters.');
        }

        if (
            in_array($validated['issue_type'], ['hair_or_foreign_object', 'spilled_or_damaged', 'not_fresh'], true)
            && empty($validated['photos'])
        ) {
            return response()->json([
                'message' => 'Please add at least one photo for this issue.',
                'errors' => ['photos' => ['At least one photo is required.']],
            ], 422);
        }

        $user = $request->user();
        $created = DB::transaction(function () use ($request, $orderId, $validated, $user) {
            $order = Order::query()->with('orderItems')->lockForUpdate()->findOrFail($orderId);
            if (
                $order->user_id !== $user->id
                && ! ($order->user_id === null && strtolower((string) $order->email) === strtolower((string) $user->email))
            ) {
                abort(403, 'This order does not belong to your account.');
            }

            if (
                strtolower((string) $order->status) !== 'delivered'
                || $order->delivery_type === 'onsite'
                || $order->delivery_calculation_method === 'onsite'
                || $order->third_party_platform
            ) {
                abort(422, 'Only delivered online Oppa Dru orders can be reported.');
            }

            $deliveredAt = $order->delivery_confirmed_at;
            if (! $deliveredAt) {
                $deliveredEntry = collect($order->status_history ?? [])
                    ->reverse()
                    ->first(fn (array $entry) => strtolower((string) ($entry['status'] ?? '')) === 'delivered');
                $deliveredAt = isset($deliveredEntry['created_at'])
                    ? \Illuminate\Support\Carbon::parse($deliveredEntry['created_at'])
                    : null;
            }
            if (! $deliveredAt || $deliveredAt->isFuture()
                || $deliveredAt->lt(now()->subHours(OrderReplacementPolicy::CUSTOMER_REPORT_WINDOW_HOURS))) {
                abort(422, 'The 6-hour reporting window has ended. Please contact your branch for help.');
            }

            $openRequests = $order->replacementRequests()
                ->whereIn('status', OrderReplacementPolicy::OPEN_STATUSES)
                ->with('replacementOrder:id,status')
                ->get()
                ->contains(fn (OrderReplacementRequest $replacementRequest) => (
                    $replacementRequest->status !== 'replacement_sent'
                    || ! $replacementRequest->replacementOrder
                    || ! in_array(strtolower((string) $replacementRequest->replacementOrder->status), ['delivered', 'completed'], true)
                ));
            if ($openRequests) {
                abort(409, 'There is already an open replacement request for this order.');
            }

            $affectedItems = $this->replacementService->itemPayload($order, $validated['item_ids']);
            $photoPaths = [];
            foreach ($request->file('photos', []) as $photo) {
                $path = Storage::disk('public')->putFile(
                    'replacement-requests/'.$order->id,
                    $photo,
                );
                if (! $path) {
                    abort(500, 'A replacement request photo could not be saved.');
                }
                $photoPaths[] = $path;
            }

            $replacementRequest = OrderReplacementRequest::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'branch_id' => $order->branch_id,
                'franchise_id' => $order->franchise_id,
                'franchise_account_id' => $order->franchise_account_id,
                'issue_type' => $validated['issue_type'],
                'affected_items' => $affectedItems,
                'description' => $validated['description'],
                'photo_paths' => $photoPaths,
                'status' => 'pending',
            ]);

            return [$replacementRequest, $order];
        });

        $this->notifyCustomer($created[0], 'pending');

        return response()->json([
            'message' => 'Sorry about that! We’ll send a replacement. You don’t need to return the food.',
            'request' => $this->formatRequest($created[0]),
        ], 201);
    }

    public function reportAdmin(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $requests = OrderReplacementRequest::query()
            ->with('replacementOrder:id,status')
            ->when($validated['from'] ?? null, fn (Builder $query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($validated['to'] ?? null, fn (Builder $query, string $date) => $query->whereDate('created_at', '<=', $date))
            ->get();

        return response()->json([
            'replacements' => $this->replacementStats($requests),
        ]);
    }

    public function reportFranchise(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Branch access required.'], 403);
        }

        return response()->json([
            'replacements' => $this->replacementStats(
                $this->branchRequests((string) $user->franchise_id)
                    ->with('replacementOrder:id,status')
                    ->when($validated['from'] ?? null, fn (Builder $query, string $date) => $query->whereDate('created_at', '>=', $date))
                    ->when($validated['to'] ?? null, fn (Builder $query, string $date) => $query->whereDate('created_at', '<=', $date))
                    ->get(),
            ),
        ]);
    }

    public function indexAdmin(Request $request)
    {
        $query = OrderReplacementRequest::query()->with([
            'order.user:id,full_name,email',
            'replacementOrder:id,order_number,status,created_at',
        ]);
        $status = (string) $request->query('status', 'all');
        if ($status === 'pending') {
            $query->where('status', 'pending');
        } elseif ($status === 'done') {
            $query->whereIn('status', ['approved', 'rejected', 'replacement_sent']);
        }

        $requests = $query->orderBy('created_at', $status === 'pending' ? 'asc' : 'desc')->get();
        $monthlyRequests = OrderReplacementRequest::query()
            ->whereHas('replacementOrder', fn (Builder $replacementQuery) => $replacementQuery
                ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()]))
            ->with('replacementOrder:id,order_number,status,created_at')
            ->get();

        return response()->json([
            'data' => $requests->map(fn (OrderReplacementRequest $item) => $this->formatRequest($item, true)),
            'waiting_count' => OrderReplacementRequest::query()->where('status', 'pending')->count(),
            'replacements' => $this->replacementStats(OrderReplacementRequest::query()->with('replacementOrder:id,status')->get()),
            'monthly_replacements' => $this->replacementStats($monthlyRequests),
        ]);
    }

    public function indexFranchise(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Branch access required.'], 403);
        }

        $status = (string) $request->query('status', 'all');
        $query = $this->branchRequests((string) $user->franchise_id)->with([
            'order.user:id,full_name,email',
            'replacementOrder:id,order_number,status,created_at',
        ]);
        $this->applyRequestFilter($query, $status);
        $requests = $query->orderBy('created_at', $status === 'pending' ? 'asc' : 'desc')->get();
        $monthlyRequests = $this->branchRequests((string) $user->franchise_id)
            ->whereHas('replacementOrder', fn (Builder $replacementQuery) => $replacementQuery
                ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()]))
            ->with('replacementOrder:id,order_number,status,created_at')
            ->get();

        return response()->json([
            'data' => $requests->map(fn (OrderReplacementRequest $item) => $this->formatRequest($item, true, (string) $user->franchise_id)),
            'waiting_count' => $this->branchRequests((string) $user->franchise_id)->where('status', 'pending')->count(),
            'replacements' => $this->replacementStats(
                $this->branchRequests((string) $user->franchise_id)->with('replacementOrder:id,status')->get(),
            ),
            'monthly_replacements' => $this->replacementStats($monthlyRequests),
        ]);
    }

    public function reviewAdmin(Request $request, string $id)
    {
        return $this->reviewRequest($request, $id, null);
    }

    public function reviewFranchise(Request $request, string $id)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Branch access required.'], 403);
        }

        return $this->reviewRequest($request, $id, (string) $user->franchise_id);
    }

    public function replaceOnsiteAdmin(Request $request, string $orderId)
    {
        return $this->replaceOnsite($request, $orderId, null, null);
    }

    public function replaceOnsiteFranchise(Request $request, string $orderId)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Branch access required.'], 403);
        }

        return $this->replaceOnsite($request, $orderId, (string) $user->franchise_id, null);
    }

    public function replaceOnsiteEmployee(Request $request, string $orderId)
    {
        $user = $request->user();
        if (! $user instanceof Employee || strtolower((string) $user->position) !== 'cashier') {
            return response()->json(['message' => 'Cashier access required.'], 403);
        }
        $branchId = $user->franchise_id;
        if (! $branchId) {
            $branchId = Franchise::query()->where('is_main', true)->value('id');
        }
        if (! $branchId) {
            return response()->json(['message' => 'Branch access required.'], 403);
        }

        return $this->replaceOnsite($request, $orderId, (string) $branchId, (string) $user->id);
    }

    public function statusForOrder(Order $order): ?array
    {
        $item = $order->replacementRequests()
            ->with('replacementOrder:id,order_number,status')
            ->latest()
            ->first();

        return $item ? $this->formatRequest($item) : null;
    }

    private function reviewRequest(Request $request, string $id, ?string $branchId)
    {
        if (
            ! Schema::hasColumn('orders', 'replacement_of_order_id')
            || ! Schema::hasColumn('order_replacement_requests', 'handled_by_name')
        ) {
            return response()->json([
                'message' => 'Replacement database updates are not applied. Please contact the system administrator.',
            ], 503);
        }

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'reject_reason' => [
                Rule::requiredIf($request->input('action') === 'reject'),
                'nullable',
                'string',
                'min:'.config('input_limits.reason.min'),
                'max:'.config('input_limits.reason.max'),
            ],
        ]);
        if ($validated['action'] === 'reject') {
            $validated['reject_reason'] = trim($validated['reject_reason']);
            if (mb_strlen($validated['reject_reason']) < (int) config('input_limits.reason.min')) {
                abort(422, 'A rejection reason must be at least 3 characters.');
            }
        }

        try {
            [$replacementRequest, $replacement] = DB::transaction(function () use ($request, $id, $branchId, $validated) {
                $query = OrderReplacementRequest::query()->with('order.orderItems.addons');
                if ($branchId !== null) {
                    $query = $this->branchRequests($branchId)->with('order.orderItems.addons');
                }
                $replacementRequest = $query->lockForUpdate()->findOrFail($id);
                if ($replacementRequest->status !== 'pending') {
                    abort(409, 'This replacement request has already been handled.');
                }
                if (! $replacementRequest->order) {
                    abort(422, 'The original order is no longer available. Please contact support.');
                }

                if ($validated['action'] === 'reject') {
                    $replacementRequest->update([
                        'status' => 'rejected',
                        'reject_reason' => $validated['reject_reason'],
                        'handled_by' => (string) $request->user()->getKey(),
                        'handled_by_name' => $this->actorName($request->user()),
                        'handled_at' => now(),
                    ]);

                    return [$replacementRequest->fresh(), null];
                }

                $affectedItems = collect($replacementRequest->affected_items ?? [])
                    ->map(function ($item): array {
                        if (
                            ! is_array($item)
                            || ! filter_var($item['order_item_id'] ?? null, FILTER_VALIDATE_INT)
                            || ! filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT)
                            || (int) $item['quantity'] < 1
                        ) {
                            abort(422, 'The affected items are incomplete. Please contact support.');
                        }

                        return [
                            'order_item_id' => (int) $item['order_item_id'],
                            'quantity' => (int) $item['quantity'],
                        ];
                    })
                    ->all();
                if ($affectedItems === []) {
                    abort(422, 'The affected items are missing. Please contact support.');
                }
                $replacement = $this->replacementService->createReplacementOrder(
                    $replacementRequest->order,
                    $affectedItems,
                    $replacementRequest,
                    $request->user(),
                );

                return [$replacementRequest->fresh(), $replacement];
            });
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Replacement request was not found.'], 404);
        }

        if ($validated['action'] === 'reject') {
            $this->notifyCustomer($replacementRequest, 'rejected', $replacementRequest->reject_reason);

            return response()->json(['request' => $this->formatRequest($replacementRequest), 'message' => 'Request was not approved.']);
        }
        $this->notifyCustomer($replacementRequest, 'approved');

        return response()->json([
            'request' => $this->formatRequest($replacementRequest),
            'replacement_order' => [
                'id' => $replacement->id,
                'order_number' => $replacement->order_number,
            ],
            'message' => 'Replacement order created.',
        ]);
    }

    private function replaceOnsite(Request $request, string $orderId, ?string $branchId, ?string $cashierId)
    {
        $validated = $request->validate([
            'item_id' => ['required', 'integer'],
            'reason' => [
                'required',
                'string',
                'min:'.config('input_limits.reason.min'),
                'max:'.config('input_limits.reason.max'),
            ],
        ]);
        $validated['reason'] = trim($validated['reason']);
        if (mb_strlen($validated['reason']) < (int) config('input_limits.reason.min')) {
            abort(422, 'A replacement reason must be at least 3 characters.');
        }
        try {
            [$replacementRequest, $replacement] = DB::transaction(function () use ($request, $orderId, $branchId, $cashierId, $validated) {
                $query = Order::query()->with('orderItems.addons');
                if ($branchId !== null) {
                    $query->where(function (Builder $branchQuery) use ($branchId): void {
                        $branchQuery->where('branch_id', $branchId)
                            ->orWhere(fn (Builder $legacyQuery) => $legacyQuery->whereNull('branch_id')->where('franchise_id', $branchId));
                    });
                }
                if ($cashierId !== null) {
                    $query->where('cashier_employee_id', $cashierId);
                }
                $order = $query->lockForUpdate()->findOrFail($orderId);
                if (
                    ($order->delivery_type !== 'onsite' && $order->delivery_calculation_method !== 'onsite')
                    || $order->third_party_platform
                ) {
                    abort(422, 'Only Oppa Dru onsite orders can use this replacement action.');
                }

                $affectedItems = $this->replacementService->itemPayload($order, [(int) $validated['item_id']]);
                $replacementRequest = OrderReplacementRequest::create([
                    'order_id' => $order->id,
                    'user_id' => $order->user_id,
                    'branch_id' => $order->branch_id,
                    'franchise_id' => $order->franchise_id,
                    'franchise_account_id' => $order->franchise_account_id,
                    'issue_type' => 'other',
                    'affected_items' => $affectedItems,
                    'description' => $validated['reason'],
                    'photo_paths' => [],
                    'status' => 'pending',
                ]);
                $replacement = $this->replacementService->createReplacementOrder(
                    $order,
                    $affectedItems,
                    $replacementRequest,
                    $request->user(),
                );

                return [$replacementRequest->fresh(), $replacement];
            });
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $this->notifyCustomer($replacementRequest->fresh(), 'approved');

        return response()->json([
            'message' => 'Replacement order created.',
            'request' => $this->formatRequest($replacementRequest->fresh()),
            'replacement_order' => ['id' => $replacement->id, 'order_number' => $replacement->order_number],
        ], 201);
    }

    private function branchRequests(string $branchId): Builder
    {
        return OrderReplacementRequest::query()->where(function (Builder $query) use ($branchId): void {
            $query->where('branch_id', $branchId)
                ->orWhere(fn (Builder $legacy) => $legacy->whereNull('branch_id')->where('franchise_id', $branchId));
        });
    }

    private function applyRequestFilter(Builder $query, string $status): void
    {
        if ($status === 'pending') {
            $query->where('status', 'pending');
        } elseif ($status === 'done') {
            $query->whereIn('status', ['approved', 'rejected', 'replacement_sent']);
        }
    }

    /**
     * Costs use the unit-cost snapshots recorded by the inventory movements for
     * each replacement order, rather than menu prices.
     */
    private function replacementStats(Collection $requests): array
    {
            $byIssueType = [];
            $requestCount = 0;
            $itemCount = 0;
            $totalCost = 0.0;

            foreach ($requests as $replacementRequest) {
                $replacementOrder = $replacementRequest->replacementOrder;
                if (! $replacementOrder || strtolower((string) $replacementOrder->status) === 'cancelled') {
                    continue;
                }

                $branchId = $replacementRequest->branch_id ?: $replacementRequest->franchise_id;
                $isMainBranch = Franchise::query()->whereKey($branchId)->value('is_main');
                $deductionsTable = $isMainBranch ? 'order_ingredient_deductions' : 'branch_order_ingredient_deductions';
                $cost = (float) DB::table($deductionsTable.' as deductions')
                    ->join('stock_movements as movements', 'movements.id', '=', 'deductions.movement_id')
                    ->where('deductions.order_id', $replacementOrder->id)
                    ->where('deductions.is_reversed', false)
                    ->sum(DB::raw('deductions.quantity * COALESCE(movements.unit_cost, 0)'));
                $quantity = collect($replacementRequest->affected_items)->sum(fn (array $item) => (int) ($item['quantity'] ?? 0));
                $issueType = (string) $replacementRequest->issue_type;
                $byIssueType[$issueType] ??= ['count' => 0, 'item_count' => 0, 'cost' => 0.0];
                $byIssueType[$issueType]['count']++;
                $byIssueType[$issueType]['item_count'] += $quantity;
                $byIssueType[$issueType]['cost'] += $cost;
                $requestCount++;
                $itemCount += $quantity;
                $totalCost += $cost;
            }

            foreach ($byIssueType as &$summary) {
                $summary['cost'] = round($summary['cost'], 2);
            }
            unset($summary);

        return [
            'count' => $requestCount,
            'item_count' => $itemCount,
            'cost' => round($totalCost, 2),
            'by_issue_type' => $byIssueType,
        ];
    }

    private function notifyCustomer(OrderReplacementRequest $replacementRequest, string $status, ?string $reason = null): void
    {
        $customer = $replacementRequest->customer
            ?? ($replacementRequest->order?->user)
            ?? ($replacementRequest->order?->email
                ? User::query()->where('email', $replacementRequest->order->email)->first()
                : null);
        if ($customer) {
            try {
                $customer->notify(new ReplacementStatusNotification(
                    (string) ($replacementRequest->order?->order_number ?? $replacementRequest->order_id),
                    $status,
                    $reason,
                ));
            } catch (Throwable $exception) {
                Log::warning('Replacement request notification failed after the database change was committed.', [
                    'replacement_request_id' => $replacementRequest->id,
                    'status' => $status,
                    'exception' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function actorName(object $actor): ?string
    {
        foreach (['full_name', 'fullName', 'name'] as $attribute) {
            $name = $actor->{$attribute} ?? null;
            if (is_string($name) && trim($name) !== '') {
                return trim($name);
            }
        }

        return null;
    }

    private function formatRequest(
        OrderReplacementRequest $replacementRequest,
        bool $includeAdminFields = false,
        ?string $scopeBranchId = null,
    ): array
    {
        $replacementRequest->loadMissing(['order.user:id,full_name,email', 'replacementOrder:id,order_number,status']);
        $replacementOrder = $replacementRequest->replacementOrder;
        $status = $replacementRequest->status;
        if ($replacementOrder && in_array(strtolower((string) $replacementOrder->status), ['delivered', 'completed'], true)) {
            $status = 'replaced';
        } elseif ($replacementOrder && in_array(strtolower((string) $replacementOrder->status), ['on_the_way', 'arrived'], true)) {
            $status = 'replacement_sent';
        } elseif ($replacementOrder) {
            $status = 'approved';
        }
        $baseUrl = rtrim(request()->root(), '/');
        $data = [
            'id' => $replacementRequest->id,
            'order_id' => $replacementRequest->order_id,
            'issue_type' => $replacementRequest->issue_type,
            'affected_items' => $replacementRequest->affected_items,
            'description' => $replacementRequest->description,
            'photos' => collect($replacementRequest->photo_paths ?? [])
                ->map(fn (string $path) => $baseUrl.'/storage/'.ltrim($path, '/'))
                ->values(),
            'status' => $status,
            'reject_reason' => $replacementRequest->reject_reason,
            'replacement_order_id' => $replacementRequest->replacement_order_id,
            'replacement_order_number' => $replacementOrder?->order_number,
            'replacement_order_status' => $replacementOrder?->status,
            'created_at' => $replacementRequest->created_at?->toISOString(),
        ];

        if ($includeAdminFields) {
            $customer = $replacementRequest->order?->user;
            $pastRequestsQuery = OrderReplacementRequest::query()
                ->where('user_id', $replacementRequest->user_id)
                ->where('id', '!=', $replacementRequest->id);
            if ($scopeBranchId !== null) {
                $pastRequestsQuery->where(function (Builder $query) use ($scopeBranchId): void {
                    $query->where('branch_id', $scopeBranchId)
                        ->orWhere(fn (Builder $legacyQuery) => $legacyQuery
                            ->whereNull('branch_id')
                            ->where('franchise_id', $scopeBranchId));
                });
            }
            $deliveredAt = $replacementRequest->order?->delivery_confirmed_at;
            if (! $deliveredAt) {
                $deliveredEntry = collect($replacementRequest->order?->status_history ?? [])
                    ->reverse()
                    ->first(fn (array $entry) => strtolower((string) ($entry['status'] ?? '')) === 'delivered');
                $deliveredAt = isset($deliveredEntry['created_at'])
                    ? \Illuminate\Support\Carbon::parse($deliveredEntry['created_at'])
                    : null;
            }
            $data += [
                'customer_name' => $customer?->full_name ?? $replacementRequest->order?->email ?? 'Walk-in customer',
                'customer_email' => $replacementRequest->order?->email ?? $customer?->email,
                'customer_phone' => $replacementRequest->order?->phone,
                'order_number' => $replacementRequest->order?->order_number,
                'delivery_address' => $replacementRequest->order?->delivery_address,
                'delivered_at' => $deliveredAt?->toISOString(),
                'handled_by_name' => $replacementRequest->handled_by_name,
                'handled_at' => $replacementRequest->handled_at?->toISOString(),
                'branch_id' => $replacementRequest->branch_id ?: $replacementRequest->franchise_id,
                'past_request_count' => $replacementRequest->user_id ? $pastRequestsQuery->count() : 0,
            ];
        }

        return $data;
    }
}

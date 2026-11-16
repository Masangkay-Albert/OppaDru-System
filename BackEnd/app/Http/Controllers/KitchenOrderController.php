<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Franchise;
use App\Models\Order;
use App\Support\OrderStatus;
use App\Services\Order\ScheduleService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KitchenOrderController extends Controller
{
    public function __construct(private readonly ScheduleService $scheduleService) {}

    public function index(Request $request)
    {
        $employee = $request->user();
        if (! $employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $tab = $request->query('tab', 'pending');
        $orders = $this->ordersForTab($this->branchIdForEmployee($employee), $tab);

        return response()->json($orders->map(fn (Order $order) => $this->formatKitchenOrder($order))->values());
    }

    public function counts(Request $request)
    {
        $employee = $request->user();
        if (! $employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $pendingOrders = $this->ordersForBranch($this->branchIdForEmployee($employee))
            ->with(['user', 'branch:id,name', 'franchise:id,name', 'originalOrder:id,order_number'])
            ->where('status', 'pending')
            ->where(function (Builder $query): void {
                $this->whereCustomerCancellationWindowElapsed($query);
            })
            ->get();
        $scheduled = $pendingOrders->filter(fn (Order $order) => $this->isInScheduledTab($order))->values();
        $promoted = $pendingOrders->filter(fn (Order $order) => $this->isInNewOrdersTab($order))->values();

        return response()->json([
            'scheduled_count' => $scheduled->count(),
            'new_count' => $promoted->count(),
            'promoted_orders' => $promoted
                ->filter(fn (Order $order) => $this->scheduleService->isScheduled($order))
                ->map(fn (Order $order) => $this->formatKitchenOrder($order))
                ->values(),
        ]);
    }

    public function reschedule(Request $request, string $id)
    {
        $employee = $request->user();
        if (! $employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $validated = $request->validate([
            'scheduled_for' => ['required', 'date', 'after:now'],
        ]);
        $branchId = $this->branchIdForEmployee($employee);
        $order = $this->ordersForBranch($branchId)
            ->where('status', 'pending')
            ->findOrFail($id);
        if (! $this->scheduleService->isScheduled($order)) {
            return response()->json(['message' => 'Only scheduled orders can be rescheduled.'], 422);
        }

        $scheduledFor = Carbon::parse($validated['scheduled_for'], 'Asia/Manila')->timezone('Asia/Manila');
        $franchise = $employee->franchise ?? ($branchId ? Franchise::find($branchId) : null);
        $hoursError = $this->scheduleService->operatingHoursError($franchise, $scheduledFor);
        if ($hoursError) {
            return response()->json(['errors' => ['scheduled_for' => [$hoursError]]], 422);
        }

        $previousSchedule = $this->scheduleService->scheduledFor($order);
        $order->update([
            'is_scheduled' => true,
            'scheduled_for' => $scheduledFor->copy()->utc(),
            'scheduled_at' => $scheduledFor->copy()->utc(),
            'scheduled_date' => $scheduledFor->format('Y-m-d'),
            'scheduled_time' => $scheduledFor->format('g:i A'),
            'schedule_window' => $scheduledFor->format('g:i A'),
            'schedule_display' => $scheduledFor->format('M j, Y • g:i A'),
            'rescheduled_from' => $previousSchedule?->copy()->utc(),
        ]);

        return response()->json([
            'message' => 'Order rescheduled successfully.',
            'order' => $this->formatKitchenOrder($order->fresh(['user', 'branch:id,name', 'franchise:id,name'])),
        ]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $employee = $request->user();
        if (! $employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $request->validate([
            'status' => ['required', 'string', Rule::in(OrderStatus::KITCHEN_ALLOWED)],
            'start_early' => 'sometimes|boolean',
            'items_completed' => 'sometimes|boolean',
        ]);
        if (
            in_array($request->input('status'), ['preparing', 'prepared'], true)
            && ! $request->boolean('items_completed')
        ) {
            return response()->json([
                'message' => 'Mark every order item complete before changing the preparation status.',
                'errors' => ['items_completed' => ['Mark every order item complete before continuing.']],
            ], 422);
        }

        $order = $this->ordersForBranch($this->branchIdForEmployee($employee))
            ->with(['branch:id,name', 'franchise:id,name'])
            ->findOrFail($id);
        if (
            $request->input('status') === 'preparing'
            && $order->status === 'pending'
            && $order->user_id
            && $order->created_at
            && $order->created_at->gt(now()->subSeconds((int) config('orders.customer_cancellation_window_seconds', 30)))
        ) {
            return response()->json([
                'message' => 'This customer order is still in its cancellation window.',
            ], 422);
        }
        if ($request->input('status') === 'preparing' && $this->scheduleService->isScheduled($order)) {
            $scheduledFor = $this->scheduleService->scheduledFor($order);
            if ($scheduledFor && $this->scheduleService->prepStartTime($scheduledFor)->isFuture() && ! $request->boolean('start_early')) {
                return response()->json([
                    'message' => 'Preparation for this scheduled order starts at '.$this->scheduleService->prepStartTime($scheduledFor)->format('g:i A').'.',
                ], 422);
            }
        }

        $isOnsiteOrder = $order->delivery_type === 'onsite'
            || $order->delivery_calculation_method === 'onsite'
            || str_starts_with(strtolower((string) $order->delivery_address), 'onsite');
        $order->status = $request->status === OrderStatus::PREPARED && $isOnsiteOrder
            ? OrderStatus::DELIVERED
            : $request->status;
        $order->save();
        $order->setAttribute('branch_name', $order->branch?->name ?? $order->franchise?->name);

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order,
        ]);
    }

    private function branchIdForEmployee(Employee $employee): ?string
    {
        if ($employee->franchise_id) {
            return (string) $employee->franchise_id;
        }

        $mainBranchId = Franchise::query()->where('is_main', true)->value('id');

        return $mainBranchId !== null ? (string) $mainBranchId : null;
    }

    private function ordersForBranch(?string $branchId): Builder
    {
        return Order::query()
            ->withoutProofImagePayload()
            ->where(function (Builder $query) use ($branchId): void {
                if ($branchId === null) {
                    $query->whereNull('branch_id')->whereNull('franchise_id');

                    return;
                }

                $query->where('branch_id', $branchId)
                    ->orWhere(function (Builder $legacyQuery) use ($branchId): void {
                        $legacyQuery->whereNull('branch_id')
                            ->where('franchise_id', $branchId);
                    });
            });
    }

    private function ordersForTab(?string $branchId, string $tab)
    {
        $query = $this->ordersForBranch($branchId)
            ->with(['user', 'branch:id,name', 'franchise:id,name', 'originalOrder:id,order_number']);

        if ($tab === 'scheduled') {
            $pending = $query->where('status', 'pending')
                ->where(fn (Builder $pendingQuery) => $this->whereCustomerCancellationWindowElapsed($pendingQuery))
                ->orderByRaw('CASE WHEN replacement_of_order_id IS NOT NULL THEN 0 ELSE 1 END')
                ->orderBy('created_at')
                ->get();

            return $pending->filter(fn (Order $order) => $this->isInScheduledTab($order));
        }

        if ($tab === 'pending') {
            $pending = $query->where('status', 'pending')
                ->where(fn (Builder $pendingQuery) => $this->whereCustomerCancellationWindowElapsed($pendingQuery))
                ->orderByRaw('CASE WHEN replacement_of_order_id IS NOT NULL THEN 0 ELSE 1 END')
                ->orderBy('created_at')
                ->get();

            return $pending->filter(fn (Order $order) => $this->isInNewOrdersTab($order));
        }

        if ($tab === 'preparing') {
            return $query->where('status', 'preparing')
                ->orderByRaw('CASE WHEN replacement_of_order_id IS NOT NULL THEN 0 ELSE 1 END')
                ->orderBy('created_at')->get();
        }

        return $query
            ->whereIn('status', ['prepared', 'ready', 'delivered', 'completed', 'cancelled'])
            ->orderByRaw('CASE WHEN replacement_of_order_id IS NOT NULL THEN 0 ELSE 1 END')
            ->orderByDesc('created_at')
            ->get();
    }

    private function isInScheduledTab(Order $order): bool
    {
        if (! $this->scheduleService->isScheduled($order)) {
            return false;
        }

        $scheduledFor = $this->scheduleService->scheduledFor($order);

        return $scheduledFor !== null && $this->scheduleService->prepStartTime($scheduledFor)->isFuture();
    }

    private function whereCustomerCancellationWindowElapsed(Builder $query): Builder
    {
        return $query->where(function (Builder $visibleQuery): void {
            $visibleQuery->whereNull('user_id')
                ->orWhere(
                    'created_at',
                    '<=',
                    now()->subSeconds((int) config('orders.customer_cancellation_window_seconds', 30)),
                );
        });
    }

    private function isInNewOrdersTab(Order $order): bool
    {
        if (! $this->scheduleService->isScheduled($order)) {
            return true;
        }

        $scheduledFor = $this->scheduleService->scheduledFor($order);

        return $scheduledFor === null || $this->scheduleService->prepStartTime($scheduledFor)->isPast();
    }

    private function formatKitchenOrder(Order $order): array
    {
        $customerName = 'Guest Customer';
        if ($order->user) {
            $name = trim(($order->user->first_name ?? '').' '.($order->user->last_name ?? ''));
            $customerName = $name ?: ($order->user->full_name ?? 'Customer');
        } elseif (! empty($order->delivery_address) && preg_match('/Customer:\s*([^)|]+)/i', (string) $order->delivery_address, $matches)) {
            $customerName = trim($matches[1]);
        }

        $items = collect($order->items ?? [])->map(fn (array $item) => [
            'name' => $item['name'] ?? $item['product_name'] ?? $item['title'] ?? 'Item',
            'quantity' => (int) ($item['quantity'] ?? 0),
            'selected_size' => $item['selected_size'] ?? null,
            'selected_addons' => collect($item['selected_addons'] ?? [])->map(fn (array $addon) => [
                'name' => $addon['name'] ?? $addon['addon_name'] ?? 'Add-on',
                'quantity' => (int) ($addon['quantity'] ?? 1),
            ])->values(),
            'special_instructions' => $item['special_instructions'] ?? null,
        ])->values();
        $scheduledFor = $this->scheduleService->scheduledFor($order);
        $isScheduled = $this->scheduleService->isScheduled($order) && $scheduledFor !== null;

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'is_replacement' => (bool) $order->replacement_of_order_id,
            'replacement_of_order_id' => $order->replacement_of_order_id,
            'original_order_number' => $order->originalOrder?->order_number,
            'branch_name' => $order->branch?->name ?? $order->franchise?->name,
            'customerName' => $customerName,
            'phone' => $order->phone,
            'channel' => $order->delivery_type === 'onsite' || $order->delivery_calculation_method === 'onsite'
                || str_starts_with(strtolower((string) $order->delivery_address), 'onsite') ? 'onsite' : 'online',
            'status' => $order->status,
            'include_cutlery' => (bool) $order->include_cutlery,
            'items' => $items,
            'scheduleDisplay' => $order->schedule_display,
            'deliveryType' => $order->delivery_type,
            'fulfillmentType' => $order->fulfillment_type ?? ($order->delivery_type === 'onsite' ? 'pickup' : 'delivery'),
            'isScheduled' => $isScheduled,
            'scheduledFor' => $scheduledFor?->toIso8601String(),
            'prepStartTime' => $scheduledFor ? $this->scheduleService->prepStartTime($scheduledFor)->toIso8601String() : null,
            'prepLeadTimeMinutes' => (int) config('kitchen.prep_lead_time_minutes', 30),
            'rescheduledFrom' => $order->rescheduled_from?->toIso8601String(),
            'specialInstructions' => $order->special_instructions ?: $items->pluck('special_instructions')->filter()->implode("\n"),
            'paymentMethod' => $order->payment_method,
            'paymentStatus' => $order->payment_status,
            'created_at' => $order->created_at?->toIso8601String(),
        ];
    }
}

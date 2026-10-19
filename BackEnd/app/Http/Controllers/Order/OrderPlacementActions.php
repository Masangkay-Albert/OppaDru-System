<?php

namespace App\Http\Controllers\Order;

use App\Models\Addon;
use App\Models\DiscountVerificationRequest;
use App\Models\Franchise;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\PricingService;
use App\Support\DatabaseImage;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

trait OrderPlacementActions
{
    private function decodeArrayInput(Request $request, string $key): void
    {
        $value = $request->input($key);
        if (! is_string($value)) {
            return;
        }

        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $request->merge([$key => $decoded]);
        }
    }

    private function resolveScheduledDelivery(Request $request): array
    {
        $deliveryType = strtolower((string) $request->input('delivery_type', 'standard'));

        if ($deliveryType !== 'scheduled') {
            return [
                'scheduled_at' => null,
                'scheduled_date' => null,
                'scheduled_time' => null,
                'schedule_display' => null,
                'schedule_window' => null,
            ];
        }

        $scheduledAtInput = $request->input('scheduled_at');
        $scheduledDate = $request->input('scheduled_date');
        $scheduledTime = $request->input('scheduled_time');
        $scheduleWindow = $request->input('schedule_window');

        $candidates = [];
        if ($scheduledAtInput) {
            $candidates[] = $scheduledAtInput;
        }

        if ($scheduledDate || $scheduledTime || $scheduleWindow) {
            $datePart = $scheduledDate ?: Carbon::now('Asia/Manila')->format('Y-m-d');
            $timePart = $scheduledTime ?: $scheduleWindow ?: '12:00 PM';
            $candidates[] = $datePart.' '.$timePart;
        }

        $parsed = null;
        foreach ($candidates as $candidate) {
            try {
                $parsed = Carbon::parse($candidate, 'Asia/Manila');
                break;
            } catch (\Throwable) {
                continue;
            }
        }

        if (! $parsed) {
            throw new \InvalidArgumentException('Scheduled delivery requires a valid future date and time.');
        }

        if (! $parsed->isFuture()) {
            throw new \InvalidArgumentException('Scheduled delivery must be set for a future date and time.');
        }

        $scheduleWindowValue = $scheduleWindow
            ?: $scheduledTime
            ?: $parsed->setTimezone('Asia/Manila')->format('g:i A');
        $scheduleDisplayValue = $request->input('schedule_display')
            ?: $parsed->setTimezone('Asia/Manila')->format('M j, Y • g:i A');

        return [
            'scheduled_at' => $parsed->setTimezone('Asia/Manila')->toDateTimeString(),
            'scheduled_date' => $parsed->setTimezone('Asia/Manila')->format('Y-m-d'),
            'scheduled_time' => $scheduledTime ?: $scheduleWindowValue,
            'schedule_display' => $scheduleDisplayValue,
            'schedule_window' => $scheduleWindowValue,
        ];
    }

    public function store(Request $request)
    {
        if (! $request->hasFile('proof_image') && $request->hasFile('discount_proof_image')) {
            $request->files->set('proof_image', $request->file('discount_proof_image'));
        }

        $this->decodeArrayInput($request, 'items');
        $this->decodeArrayInput($request, 'delivery_coordinates');

        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_name' => 'required|string',
            'items.*.product_price' => 'required|numeric',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.special_instructions' => 'nullable|string',
            'total' => 'nullable|numeric|min:0',
            'delivery_address' => 'required|string',
            'payment_method' => 'required|string|in:cash_on_delivery,gcash,credit_card',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'fulfillment_type' => 'nullable|string|in:pickup,delivery',
            'scheduled_at' => 'nullable|date',
            'scheduled_date' => 'nullable|date',
            'scheduled_time' => 'nullable|string',
            'schedule_display' => 'nullable|string',
            'schedule_window' => 'nullable|string',
            'voucher_discount' => 'nullable|numeric|min:0',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
            'phone' => 'required|string',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'franchise_id' => 'nullable|string|exists:franchises,id',
            'proof_image' => 'nullable|file|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'discount_proof_image' => 'nullable|file|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'payment_reference' => [
                'required_if:payment_method,gcash,credit_card',
                'nullable',
                'string',
                'exists:payments,reference',
            ],
        ]);

        $validator->after(function ($validator) use ($request) {
            if (
                $request->filled('discount_type')
                && ! $request->hasFile('proof_image')
                && ! $request->hasFile('discount_proof_image')
            ) {
                $validator->errors()->add(
                    'proof_image',
                    'The proof image field is required when discount type is present.'
                );
            }

            if (strtolower((string) $request->input('delivery_type', 'standard')) !== 'scheduled') {
                return;
            }

            $scheduledAtInput = $request->input('scheduled_at');
            $scheduledDate = $request->input('scheduled_date');
            $scheduledTime = $request->input('scheduled_time');
            $scheduleWindow = $request->input('schedule_window');

            if (! $scheduledAtInput && (! $scheduledDate || (! $scheduledTime && ! $scheduleWindow))) {
                $validator->errors()->add('scheduled_at', 'Scheduled delivery requires a valid future date and time.');

                return;
            }

            try {
                $scheduledData = $this->resolveScheduledDelivery($request);
            } catch (\InvalidArgumentException $exception) {
                $validator->errors()->add('scheduled_at', $exception->getMessage());

                return;
            }

            if ($scheduledData['scheduled_at'] === null) {
                $validator->errors()->add('scheduled_at', 'Scheduled delivery requires a valid future date and time.');
            }
        });

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $isPickup = $request->input('fulfillment_type') === 'pickup';
        try {
            $branchResolution = $this->branchRoutingService->resolve(
                $request->input('delivery_coordinates'),
                $isPickup ? $request->input('franchise_id') : null,
                $isPickup,
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $unavailableItems = $this->branchRoutingService->validateCatalog((string) $branchResolution['branch']->id, $request->input('items', []));
        if ($unavailableItems !== []) {
            return response()->json(['message' => 'One or more items are unavailable at the assigned branch.', 'unavailable_items' => $unavailableItems], 422);
        }
        $request->merge(['franchise_id' => $branchResolution['branch']->id]);

        try {
            $scheduledData = $this->resolveScheduledDelivery($request);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['errors' => ['scheduled_at' => [$exception->getMessage()]]], 422);
        }
        if ($scheduledData['scheduled_at'] !== null) {
            $franchise = $request->filled('franchise_id')
                ? Franchise::find($request->input('franchise_id'))
                : null;
            $hoursError = $this->scheduleService->operatingHoursError(
                $franchise,
                Carbon::parse($scheduledData['scheduled_at'], 'Asia/Manila')
            );
            if ($hoursError) {
                return response()->json(['errors' => ['scheduled_at' => [$hoursError]]], 422);
            }
        }

        $discountType = trim((string) $request->input('discount_type', ''));
        $discountRate = $discountType !== '' ? (float) $request->input('discount_rate', 0.20) : 0.0;

        try {
            $pricing = app(PricingService::class)->calculate(
                $request->items,
                $request->input('delivery_type', 'standard'),
                (float) $request->input('voucher_discount', 0),
                $discountRate,
                $request->input('delivery_coordinates'),
                ['lat' => (float) $branchResolution['branch']->latitude, 'lng' => (float) $branchResolution['branch']->longitude],
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $total = $pricing['total'];
        $payment = null;
        if (in_array($request->payment_method, ['gcash', 'credit_card'], true)) {
            $payment = Payment::where('reference', $request->payment_reference)->first();
            $franchiseId = $request->input('franchise_id');
            if (
                ! $payment
                || $payment->status !== 'paid'
                || round((float) $payment->amount) !== $total
                || ($franchiseId !== null
                    && (string) data_get($payment->metadata, 'franchise_id') !== (string) $franchiseId)
            ) {
                return response()->json(['message' => 'Payment is not confirmed for this order.'], 422);
            }

            $existingOrder = Order::where('payment_reference', $payment->reference)->first();
            if ($existingOrder) {
                return response()->json([
                    'order' => $existingOrder,
                    'message' => 'Order was already placed.',
                ]);
            }
            if ($payment->order_id !== null) {
                return response()->json(['message' => 'Payment is not available for this order.'], 422);
            }
        }

        $orderItems = $this->orderDataService->buildOrderItems($request->items);

        $user = User::where('email', $request->email)->first();
        $userId = $user ? $user->id : null;

        $discountAmount = 0;
        $discountProofData = null;

        if ($discountType !== '') {
            $discountAmount = $pricing['discountAmount'];
            if ($request->hasFile('proof_image') || $request->hasFile('discount_proof_image')) {
                $file = $request->file('proof_image') ?? $request->file('discount_proof_image');
                $discountProofData = DatabaseImage::fromUploadedFile($file);
            }
        }

        try {
            $order = DB::transaction(function () use (
                $request,
                $scheduledData,
                $pricing,
                $total,
                $payment,
                $orderItems,
                $userId,
                $discountType,
                $discountRate,
                $discountAmount,
                $discountProofData,
                $branchResolution,
            ) {
                $franchiseId = $request->input('franchise_id');
                if ($franchiseId) {
                    $this->franchiseInventoryService->consume((string) $franchiseId, $request->input('items'));
                }
                if ($payment) {
                    $lockedPayment = Payment::whereKey($payment->id)->lockForUpdate()->first();
                    if (
                        ! $lockedPayment
                        || $lockedPayment->status !== 'paid'
                        || $lockedPayment->order_id !== null
                        || round((float) $lockedPayment->amount) !== $total
                        || ($franchiseId !== null
                            && (string) data_get($lockedPayment->metadata, 'franchise_id') !== (string) $franchiseId)
                    ) {
                        throw new \InvalidArgumentException('Payment is not available for this order.');
                    }
                }

                $order = Order::create([
                    'franchise_id' => $branchResolution['branch']->id,
                    'franchise_account_id' => $branchResolution['branch']->franchise_account_id,
                    'branch_id' => $branchResolution['branch']->id,
                    'email' => $request->email,
                    'user_id' => $userId,
                    'total' => $total,
                    'delivery_type' => $request->input('delivery_type', 'standard'),
                    'delivery_address' => $request->delivery_address,
                    'delivery_fee' => $pricing['deliveryFee'],
                    'delivery_distance_km' => $pricing['deliveryDistanceKm'],
                    'distance_km' => $branchResolution['distance_km'],
                    'delivery_calculation_method' => $pricing['deliveryCalculationMethod'],
                    'service_fee' => $pricing['serviceFee'],
                    'priority_fee' => $pricing['priorityFee'],
                    'vat' => $pricing['vat'],
                    'service_fee_rule' => $pricing['serviceFeeRule'],
                    'status' => 'pending',
                    'payment_method' => $request->payment_method,
                    'phone' => $request->phone,
                    'items' => $orderItems,
                    'scheduled_at' => $scheduledData['scheduled_at'],
                    'scheduled_date' => $scheduledData['scheduled_date'],
                    'scheduled_time' => $scheduledData['scheduled_time'],
                    'schedule_display' => $scheduledData['schedule_display'],
                    'schedule_window' => $scheduledData['schedule_window'],
                    'payment_reference' => $payment?->reference,
                    'payment_status' => $payment ? 'paid' : 'pending',
                    'is_scheduled' => $scheduledData['scheduled_at'] !== null,
                    'scheduled_for' => $scheduledData['scheduled_at'],
                    'fulfillment_type' => $request->input(
                        'fulfillment_type',
                        strtolower((string) $request->input('delivery_type')) === 'onsite' ? 'pickup' : 'delivery'
                    ),
                    'special_instructions' => trim(
                        collect($orderItems)->pluck('special_instructions')->filter()->implode("\n")
                    ) ?: null,
                    'discount_type' => $discountType !== '' ? $discountType : null,
                    'discount_rate' => $discountType !== '' ? $discountRate : null,
                    'discount_amount' => $discountType !== '' ? $discountAmount : null,
                    'discount_status' => $discountType !== '' ? 'pending' : 'not_requested',
                    'discount_proof_image' => null,
                    'discount_proof_image_data' => $discountType !== '' ? $discountProofData : null,
                    'discount_requested_at' => $discountType !== '' ? now() : null,
                    'discount_rejection_reason' => null,
                    'discount_reviewed_at' => null,
                ]);

                $this->orderDataService->syncOrderItems($order, $orderItems);
                if ($payment) {
                    $lockedPayment->update(['order_id' => $order->id]);
                }

                return $order;
            });
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $discountRequest = null;
        if ($discountType !== '') {
            $discountRequest = DiscountVerificationRequest::create([
                'order_id' => $order->id,
                'discount_type' => $discountType,
                'discount_rate' => $discountRate,
                'discount_amount' => $discountAmount,
                'proof_image_url' => null,
                'proof_image_data' => $discountProofData,
                'status' => 'pending',
                'submitted_at' => now(),
                'order_total_at_submission' => $total,
            ]);
        }

        $order->refresh();
        $order->load('branch:id,name,address,latitude,longitude');

        return response()->json([
            'order' => $order,
            'discount_request' => $discountRequest,
            'message' => 'Order placed successfully!',
        ], 201);
    }
}

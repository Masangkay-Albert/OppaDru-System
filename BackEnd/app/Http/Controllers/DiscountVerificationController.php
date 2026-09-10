<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\DiscountVerificationRequest;
use App\Models\Order;
use App\Services\PricingService;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class DiscountVerificationController extends Controller
{
    use AdminAuthTrait;

    private const VALID_DISCOUNT_TYPES = ['PWD', 'Senior Citizen'];

    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $requests = DiscountVerificationRequest::with('order')->orderBy('submitted_at', 'desc')->get();

        return response()->json(['data' => $requests->map(function ($requestItem) {
            return [
                'id' => $requestItem->id,
                'order_id' => $requestItem->order_id,
                'discount_type' => $requestItem->discount_type,
                'discount_rate' => (float) $requestItem->discount_rate,
                'discount_amount' => (float) $requestItem->discount_amount,
                'proof_image_url' => $requestItem->proof_image_url,
                'status' => $requestItem->status,
                'rejection_reason' => $requestItem->rejection_reason,
                'submitted_at' => $requestItem->submitted_at?->toISOString(),
                'reviewed_at' => $requestItem->reviewed_at?->toISOString(),
                'created_at' => $requestItem->created_at?->toISOString(),
                'order' => $requestItem->order ? [
                    'id' => $requestItem->order->id,
                    'order_number' => $requestItem->order->order_number,
                    'email' => $requestItem->order->email,
                    'phone' => $requestItem->order->phone,
                    'total' => (float) $requestItem->order->total,
                    'status' => $requestItem->order->status,
                ] : null,
            ];
        })]);
    }

    public function store(Request $request, string $orderId)
    {
        $order = Order::findOrFail($orderId);

        $validator = Validator::make($request->all(), [
            'discount_type' => ['required', 'string', 'in:'.implode(',', self::VALID_DISCOUNT_TYPES)],
            'proof_image' => ['nullable', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($order->discount_status === 'pending' || $order->discount_status === 'approved') {
            return response()->json(['message' => 'A discount request is already pending or approved for this order.'], 422);
        }

        $discountType = trim((string) $request->input('discount_type'));
        $discountRate = 0.20;
        $discountAmount = round((float) $order->total * $discountRate, 2);

        $proofUrl = null;
        if ($request->hasFile('proof_image')) {
            $file = $request->file('proof_image');
            $filename = time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('discount-proof', $filename, 'public');
            $proofUrl = rtrim(config('app.url', 'https://oppadru-system-1.onrender.com'), '/') . '/storage/' . ltrim($path, '/');
        }

        $requestRecord = DiscountVerificationRequest::create([
            'order_id' => $order->id,
            'discount_type' => $discountType,
            'discount_rate' => $discountRate,
            'discount_amount' => $discountAmount,
            'proof_image_url' => $proofUrl,
            'status' => 'pending',
            'submitted_at' => now(),
            'order_total_at_submission' => $order->total,
        ]);

        $order->update([
            'discount_type' => $discountType,
            'discount_rate' => $discountRate,
            'discount_amount' => $discountAmount,
            'discount_status' => 'pending',
            'discount_proof_image' => $proofUrl,
            'discount_requested_at' => now(),
            'discount_rejection_reason' => null,
            'discount_reviewed_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'request' => $requestRecord,
            'order' => $order,
            'message' => 'Discount verification request submitted successfully.',
        ], 201);
    }

    public function updateStatus(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'action' => ['required', 'string', 'in:approve,reject'],
            'rejection_reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $discountRequest = DiscountVerificationRequest::with('order')->findOrFail($id);
        $order = $discountRequest->order;
        if (!$order) {
            return response()->json(['message' => 'Associated order not found.'], 404);
        }

        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $reviewedBy = $admin?->id;

        if ($request->input('action') === 'approve') {
            $discountRate = (float) $discountRequest->discount_rate;
            $discountAmount = round((float) $order->total * $discountRate, 2);
            $discountRequest->update([
                'status' => 'approved',
                'discount_amount' => $discountAmount,
                'reviewed_at' => now(),
                'reviewed_by_admin_id' => $reviewedBy,
                'rejection_reason' => null,
            ]);

            $order->update([
                'discount_type' => $discountRequest->discount_type,
                'discount_rate' => $discountRate,
                'discount_amount' => $discountAmount,
                'discount_status' => 'approved',
                'discount_proof_image' => $discountRequest->proof_image_url,
                'discount_rejection_reason' => null,
                'discount_reviewed_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'request' => $discountRequest->fresh(),
                'order' => $order->fresh(),
                'message' => 'Discount request approved.'
            ]);
        }

        $discountRequest->update([
            'status' => 'rejected',
            'rejection_reason' => $request->input('rejection_reason') ?: 'No reason provided.',
            'reviewed_at' => now(),
            'reviewed_by_admin_id' => $reviewedBy,
        ]);

        $order->update([
            'discount_type' => $discountRequest->discount_type,
            'discount_rate' => $discountRequest->discount_rate,
            'discount_amount' => 0,
            'discount_status' => 'rejected',
            'discount_proof_image' => $discountRequest->proof_image_url,
            'discount_rejection_reason' => $request->input('rejection_reason') ?: 'No reason provided.',
            'discount_reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'request' => $discountRequest->fresh(),
            'order' => $order->fresh(),
            'message' => 'Discount request rejected.'
        ]);
    }
}

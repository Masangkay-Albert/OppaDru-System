<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\DiscountApplication;
use App\Notifications\DiscountApplicationDecisionNotification;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class DiscountApplicationController extends Controller
{
    use AdminAuthTrait;

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'discount_type' => ['required', 'string', 'in:PWD,Senior Citizen'],
            'full_name' => ['required', 'string', 'max:255'],
            'id_number' => ['required', 'string', 'max:255'],
            'expiry_date' => ['nullable', 'date'],
            'proof_image' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();
        $userId = $user?->id;
        if (!$userId) {
            return response()->json(['message' => 'User is not authenticated.'], 401);
        }

        $proofPath = null;
        if ($request->hasFile('proof_image')) {
            $file = $request->file('proof_image');
            $filename = time() . '-' . uniqid('', true) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('discount-proof', $filename, 'public');
            $proofPath = rtrim(config('app.url', 'https://oppadru-system-1.onrender.com'), '/') . '/storage/' . ltrim($path, '/');
        }

        $application = DiscountApplication::create([
            'user_id' => $userId,
            'discount_type' => trim((string) $request->input('discount_type')),
            'full_name' => trim((string) $request->input('full_name')),
            'id_number' => trim((string) $request->input('id_number')),
            'expiry_date' => $request->input('expiry_date'),
            'proof_image_url' => $proofPath,
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Discount application submitted and is awaiting admin verification.',
            'application' => [
                'id' => $application->id,
                'discount_type' => $application->discount_type,
                'full_name' => $application->full_name,
                'id_number' => $application->id_number,
                'expiry_date' => $application->expiry_date?->toDateString(),
                'proof_image_url' => $application->proof_image_url,
                'status' => $application->status,
                'submitted_at' => $application->submitted_at?->toISOString(),
            ],
        ], 201);
    }

    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $applications = DiscountApplication::with('user:id,full_name,email')->orderBy('submitted_at', 'desc')->get();

        return response()->json(['data' => $applications->map(function ($application) {
            return [
                'id' => $application->id,
                'discount_type' => $application->discount_type,
                'full_name' => $application->full_name,
                'id_number' => $application->id_number,
                'expiry_date' => $application->expiry_date?->toDateString(),
                'proof_image_url' => $application->proof_image_url,
                'status' => $application->status,
                'rejection_reason' => $application->rejection_reason,
                'submitted_at' => $application->submitted_at?->toISOString(),
                'reviewed_at' => $application->reviewed_at?->toISOString(),
                'user' => $application->user ? [
                    'id' => $application->user->id,
                    'full_name' => $application->user->full_name,
                    'email' => $application->user->email,
                ] : null,
            ];
        })]);
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

        $application = DiscountApplication::findOrFail($id);
        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();

        if ($request->input('action') === 'approve') {
            $application->update([
                'status' => 'approved',
                'reviewed_at' => now(),
                'reviewed_by_admin_id' => $admin?->id,
                'rejection_reason' => null,
            ]);

            $this->sendDecisionEmail($application, 'approved');

            return response()->json([
                'success' => true,
                'message' => 'Discount application approved.',
                'application' => $application->fresh(),
            ]);
        }

        $reason = $request->input('rejection_reason') ?: 'No reason provided.';

        $application->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_at' => now(),
            'reviewed_by_admin_id' => $admin?->id,
        ]);

        $this->sendDecisionEmail($application, 'rejected', $reason);

        return response()->json([
            'success' => true,
            'message' => 'Discount application rejected.',
            'application' => $application->fresh(),
        ]);
    }

    protected function sendDecisionEmail(DiscountApplication $application, string $status, ?string $rejectionReason = null): void
    {
        $user = $application->user;
        if (!$user || !$user->email) {
            return;
        }

        $user->notify(new DiscountApplicationDecisionNotification(
            $application->discount_type,
            $status,
            $rejectionReason,
            $application->full_name,
        ));
    }
}

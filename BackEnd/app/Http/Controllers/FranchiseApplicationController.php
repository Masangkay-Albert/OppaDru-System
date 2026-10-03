<?php

namespace App\Http\Controllers;

use App\Models\Franchise;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FranchiseApplicationController extends Controller
{
    use AdminAuthTrait;

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'franchise_name' => 'required|string|max:255',
            'contact_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'location' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $application = FranchiseApplication::create($request->only([
            'franchise_name',
            'contact_name',
            'email',
            'phone',
            'location',
            'notes',
        ]));

        return response()->json(['data' => $application], 201);
    }

    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => FranchiseApplication::orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function review(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'action' => 'required|string|in:approve,reject',
            'admin_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $application = FranchiseApplication::findOrFail($id);

        if ($request->action === 'approve') {
            $slug = Str::slug($application->franchise_name ?: 'franchise');

            $franchise = Franchise::firstOrCreate(
                ['slug' => $slug],
                [
                    'id' => 'OPPA-FR-' . strtoupper(Str::random(8)),
                    'name' => $application->franchise_name,
                    'email' => $application->email,
                    'phone' => $application->phone,
                    'address' => $application->location,
                    'status' => 'active',
                    'owner_admin_id' => null,
                ]
            );

            FranchiseUser::firstOrCreate(
                ['email' => strtolower(trim((string) $application->email))],
                [
                    'franchise_id' => $franchise->id,
                    'full_name' => $application->contact_name,
                    'phone' => $application->phone,
                    'password' => Hash::make('Franchise@123'),
                    'is_active' => true,
                ]
            );

            $application->status = 'approved';
            $application->admin_notes = $request->input('admin_notes');
            $application->reviewed_by_admin_id = $request->header('X-Admin-Id');
            $application->reviewed_at = now();
            $application->save();

            return response()->json(['message' => 'Franchise application approved', 'data' => $application]);
        }

        $application->status = 'rejected';
        $application->admin_notes = $request->input('admin_notes');
        $application->reviewed_by_admin_id = $request->header('X-Admin-Id');
        $application->reviewed_at = now();
        $application->save();

        return response()->json(['message' => 'Franchise application rejected', 'data' => $application]);
    }

    public function stats(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => [
                'total_applications' => FranchiseApplication::count(),
                'pending_applications' => FranchiseApplication::where(function ($query) {
                    $query->whereNull('status')->orWhere('status', 'pending');
                })->count(),
                'approved_applications' => FranchiseApplication::where('status', 'approved')->count(),
                'rejected_applications' => FranchiseApplication::where('status', 'rejected')->count(),
                'recent_applications' => FranchiseApplication::orderBy('created_at', 'desc')->limit(10)->get(),
            ],
        ]);
    }
}

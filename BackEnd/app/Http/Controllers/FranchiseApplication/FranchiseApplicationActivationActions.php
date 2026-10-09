<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait FranchiseApplicationActivationActions
{
    public function activate(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = FranchiseApplication::findOrFail($id);
        if ($application->status === 'active' || $application->franchise_id || $application->franchise_account_id) {
            return response()->json([
                'message' => 'This application is already associated with an activated franchise.',
                'data' => [
                    'franchise_id' => $application->franchise_id,
                    'franchise_account_id' => $application->franchise_account_id,
                ],
            ], 409);
        }
        if ($application->status !== 'approved_for_opening') {
            return response()->json(['message' => 'Only an application approved for opening can be activated.'], 409);
        }

        $validator = Validator::make($request->all(), [
            'manager_full_name' => 'required|string|max:255',
            'manager_email' => 'required|string|email|max:255|unique:franchise_users,email',
            'manager_phone' => 'nullable|string|max:50',
            'manager_password' => 'required|string|min:12|max:255',
            'can_process_pos' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'A unique manager account and secure initial password are required.', 'errors' => $validator->errors()], 422);
        }

        $issues = $this->activationReadinessIssues($application);
        if ($issues !== []) {
            return response()->json([
                'message' => 'The franchise is not ready for activation. Complete or explicitly mark every applicable requirement before continuing.',
                'requirements' => $issues,
            ], 409);
        }

        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $activated = DB::transaction(function () use ($id, $request, $admin) {
            $application = FranchiseApplication::whereKey($id)->lockForUpdate()->firstOrFail();

            if ($application->status === 'active' || $application->franchise_id || $application->franchise_account_id) {
                abort(response()->json([
                    'message' => 'This application is already associated with an activated franchise.',
                    'data' => [
                        'franchise_id' => $application->franchise_id,
                        'franchise_account_id' => $application->franchise_account_id,
                    ],
                ], 409));
            }
            if ($application->status !== 'approved_for_opening') {
                abort(response()->json(['message' => 'The application must be approved for opening before activation.'], 409));
            }

            $issues = $this->activationReadinessIssues($application);
            if ($issues !== []) {
                abort(response()->json([
                    'message' => 'The franchise is not ready for activation.',
                    'requirements' => $issues,
                ], 409));
            }

            $name = trim($application->franchise_name) ?: 'Oppa Dru Franchise';
            $accountSlug = $this->uniqueSlug($name, FranchiseAccount::class);
            $locationSlug = $this->uniqueSlug($name.' '.$application->location, Franchise::class);
            $account = FranchiseAccount::create([
                'name' => $name,
                'slug' => $accountSlug,
                'email' => $application->email,
                'phone' => $application->phone,
                'address' => $application->applicant_address,
                'status' => 'active',
                'owner_admin_id' => $admin?->id,
                'metadata' => [
                    'application_id' => $application->id,
                    'application_reference' => $application->reference_number,
                ],
            ]);
            $location = Franchise::create([
                'franchise_account_id' => $account->id,
                'name' => $name,
                'slug' => $locationSlug,
                'email' => $application->email,
                'phone' => $application->phone,
                'address' => $application->location,
                'status' => 'active',
                'owner_admin_id' => $admin?->id,
                'metadata' => [
                    'application_id' => $application->id,
                    'application_reference' => $application->reference_number,
                    'proposed_location' => $application->location,
                ],
            ]);
            $manager = FranchiseUser::create([
                'franchise_account_id' => $account->id,
                'franchise_id' => $location->id,
                'full_name' => trim((string) $request->input('manager_full_name')),
                'email' => strtolower(trim((string) $request->input('manager_email'))),
                'phone' => $request->input('manager_phone'),
                'password' => Hash::make((string) $request->input('manager_password')),
                'is_active' => true,
                'can_process_pos' => $request->boolean('can_process_pos'),
            ]);

            $application->franchise_account_id = $account->id;
            $application->franchise_id = $location->id;
            $application->status = 'active';
            $application->activated_at = now();
            $application->activated_by_admin_id = $admin?->id;
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            $application->next_step_instructions = 'Your franchise is active. Sign in to the franchise portal using the manager credentials provided by your administrator, then configure authorized staff and cashiers for this location.';
            $application->save();

            $this->recordEvent(
                $application,
                'admin',
                $admin?->id,
                'active',
                'Franchise activated',
                'Your franchise has been activated. Follow the administrator’s instructions to access the franchise portal and complete operational setup.',
            );

            return $application->fresh(['events', 'franchiseAccount', 'franchise']);
        });

        return response()->json([
            'message' => 'Franchise activated and manager access configured.',
            'data' => $activated,
        ], 201);
    }

    private function activationReadinessIssues(FranchiseApplication $application): array
    {
        $issues = [];
        if ($application->agreement_status !== 'signed' || ! $application->agreement_signed_at) {
            $issues[] = 'The franchise agreement must be recorded as signed with its actual signing date.';
        }
        if (! in_array($application->franchise_fee_payment_status, ['paid', 'waived', 'not_applicable'], true)) {
            $issues[] = 'The applicable franchise fee must be paid, waived with a recorded reason, or explicitly marked not applicable.';
        }
        if ($application->franchise_fee_payment_status === 'paid'
            && (! $application->franchise_fee_amount || ! $application->franchise_fee_payment_reference)) {
            $issues[] = 'The paid franchise fee must include its amount and payment reference.';
        }
        if (! $application->requirements_reviewed_at) {
            $issues[] = 'An administrator must review and save the requirements checklist.';
        }
        foreach ($application->required_documents ?? [] as $document) {
            if (($document['required'] ?? false) && ! in_array($document['status'] ?? null, ['verified', 'not_applicable'], true)) {
                $issues[] = 'Required document not verified: '.($document['label'] ?? 'Unnamed document').'.';
            }
        }
        if (! in_array($application->location_readiness, ['ready', 'not_applicable'], true)) {
            $issues[] = 'Location readiness must be confirmed or explicitly marked not applicable.';
        }
        if (! in_array($application->permit_compliance_status, ['verified', 'not_applicable'], true)) {
            $issues[] = 'Permit and compliance checks must be verified or explicitly marked not applicable.';
        }
        if (! in_array($application->training_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Required training must be complete or explicitly marked not applicable.';
        }
        if (! in_array($application->operational_preparation_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Operational preparation must be complete or explicitly marked not applicable.';
        }

        return $issues;
    }

    private function uniqueSlug(string $name, string $modelClass): string
    {
        $base = Str::slug($name) ?: 'franchise';
        $slug = $base;
        $suffix = 2;
        while ($modelClass::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}

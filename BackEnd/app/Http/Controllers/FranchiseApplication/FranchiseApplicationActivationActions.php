<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Exceptions\FranchiseApprovalReadinessException;
use App\Exceptions\FranchiseApprovalException;
use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait FranchiseApplicationActivationActions
{
    public function approve(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'override_reason' => 'nullable|string|min:10|max:2000',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The approval details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $notificationWarning = null;
        try {
            $approved = app(\App\Services\FranchiseApplicationApprovalService::class)->approve(
                $id,
                $admin,
                $request->input('override_reason'),
            );
        } catch (FranchiseApprovalReadinessException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'requirements' => $exception->issues,
            ], 409);
        } catch (FranchiseApprovalException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        try {
            $loginUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/franchise/login?email='.rawurlencode($approved->email);
            Mail::raw(
                "Congratulations, {$approved->contact_name}! Your Oppa Dru franchise application has been approved.\n\n"
                ."Franchise ID: {$approved->franchise_id}\n"
                ."Application reference: {$approved->reference_number}\n\n"
                ."Your franchise dashboard is active. Sign in using the email and password from your applicant account:\n{$loginUrl}\n\n"
                ."You can now set up your menu, staff, inventory, and orders.",
                fn ($message) => $message->to($approved->email)
                    ->subject('Your Oppa Dru franchise application is approved'),
            );
        } catch (\Throwable $exception) {
            $notificationWarning = 'Approval succeeded, but the notification email could not be delivered. Contact the applicant directly and check the mail delivery logs.';
            Log::error('Franchise approval email could not be sent.', [
                'application_id' => $approved->id,
                'franchise_id' => $approved->franchise_id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'message' => 'Application approved and franchise dashboard access activated.',
            'notification_warning' => $notificationWarning,
            'data' => $approved,
        ]);
    }

    public function activate(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = FranchiseApplication::with('franchiseApplicant')->findOrFail($id);
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

        $hasRegisteredApplicant = (bool) $application->franchiseApplicant;
        $validator = Validator::make($request->all(), [
            'manager_full_name' => $hasRegisteredApplicant ? 'nullable|string|max:255' : 'required|string|max:255',
            'manager_email' => $hasRegisteredApplicant ? 'nullable|email|max:255' : 'required|string|email|max:255|unique:franchise_users,email',
            'manager_phone' => 'nullable|string|max:50',
            'manager_password' => $hasRegisteredApplicant ? 'nullable|string|min:12|max:255' : 'required|string|min:12|max:255',
            'can_process_pos' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The franchise login details are invalid.', 'errors' => $validator->errors()], 422);
        }
        if ($hasRegisteredApplicant && FranchiseUser::whereRaw('LOWER(email) = ?', [strtolower($application->franchiseApplicant->email)])->exists()) {
            return response()->json([
                'message' => 'A franchise account already uses the applicant email. Resolve that account before activating this application.',
            ], 409);
        }

        $issues = $application->activationReadinessIssues();
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

            $issues = $application->activationReadinessIssues();
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
            $applicant = $application->franchiseApplicant;
            $franchiseUserPayload = [
                'franchise_account_id' => $account->id,
                'franchise_id' => $location->id,
                'full_name' => $applicant
                    ? $applicant->full_name
                    : trim((string) $request->input('manager_full_name')),
                'email' => strtolower($applicant?->email ?: trim((string) $request->input('manager_email'))),
                'phone' => $applicant?->phone ?: $request->input('manager_phone'),
                'password' => $applicant ? 'temporary-franchise-user-password' : Hash::make((string) $request->input('manager_password')),
                'is_active' => true,
                'can_process_pos' => $request->boolean('can_process_pos'),
            ];
            $franchiseUser = FranchiseUser::create($franchiseUserPayload);
            if ($applicant) {
                $applicantPasswordHash = DB::table('franchise_applicants')
                    ->where('id', $applicant->id)
                    ->value('password');
                if (! is_string($applicantPasswordHash) || $applicantPasswordHash === '') {
                    throw new \RuntimeException('The applicant password credential could not be linked to the franchise account.');
                }
                DB::table('franchise_users')->where('id', $franchiseUser->id)->update([
                    'password' => $applicantPasswordHash,
                ]);
                $franchiseUser->refresh();
            }

            $application->franchise_account_id = $account->id;
            $application->franchise_id = $location->id;
            $application->status = 'active';
            $application->activated_at = now();
            $application->activated_by_admin_id = $admin?->id;
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            $application->next_step_instructions = $applicant
                ? 'Your franchise is active. Sign in to the franchise portal using the same email and password you used for your applicant account, then configure authorized staff and cashiers for this location.'
                : 'Your franchise is active. Sign in to the franchise portal using the manager credentials provided by your administrator, then configure authorized staff and cashiers for this location.';
            $application->save();

            $this->recordEvent(
                $application,
                'admin',
                $admin?->id,
                'active',
                'Franchise activated',
                $applicant
                    ? 'Your franchise has been activated. Sign in to the franchise portal using your applicant account email and password.'
                    : 'Your franchise has been activated. Follow the administrator’s instructions to access the franchise portal and complete operational setup.',
            );

            return $application->fresh(['events', 'franchiseAccount', 'franchise']);
        });

        return response()->json([
            'message' => 'Franchise activated and manager access configured.',
            'data' => $activated,
        ], 201);
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

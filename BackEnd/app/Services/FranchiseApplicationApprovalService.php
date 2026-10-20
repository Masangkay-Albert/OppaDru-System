<?php

namespace App\Services;

use App\Exceptions\FranchiseApprovalReadinessException;
use App\Exceptions\FranchiseApprovalException;
use App\Models\Admin;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseUser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class FranchiseApplicationApprovalService
{
    public function approve(string $applicationId, ?Admin $admin): FranchiseApplication
    {
        return DB::transaction(function () use ($applicationId, $admin) {
            $application = FranchiseApplication::whereKey($applicationId)->lockForUpdate()->firstOrFail();
            $previousStatus = $application->status;
            $wasAlreadyApproved = $previousStatus === 'approved';
            $alreadyHadFranchise = (bool) $application->franchise_id;
            if (in_array($application->status, ['rejected', 'withdrawn'], true)) {
                throw new FranchiseApprovalException('Rejected or withdrawn applications cannot be approved.');
            }
            if (! $wasAlreadyApproved && ! in_array($application->status, ['location_assessment', 'for_final_evaluation', 'approved_for_opening'], true)) {
                throw new FranchiseApprovalException('Move the application to location assessment or final evaluation before final approval.');
            }

            $applicant = $application->franchiseApplicant
                ?: FranchiseApplicant::query()->whereRaw('LOWER(email) = ?', [strtolower(trim($application->email))])->first();
            if (! $applicant) {
                throw new FranchiseApprovalException('A verified applicant account is required before final approval.');
            }
            if (! $applicant->hasVerifiedEmail()) {
                throw new FranchiseApprovalException('Verify the applicant email before final approval.');
            }

            $documentIssues = $wasAlreadyApproved ? [] : $application->finalApprovalDocumentIssues();
            if ($documentIssues !== []) {
                throw new FranchiseApprovalReadinessException($documentIssues);
            }
            $openingReadinessIssues = $wasAlreadyApproved ? [] : $application->activationReadinessIssues();

            $email = strtolower(trim($applicant->email));
            $applicantPasswordHash = DB::table('franchise_applicants')
                ->where('id', $applicant->id)
                ->value('password');
            if (! is_string($applicantPasswordHash) || $applicantPasswordHash === '') {
                throw new FranchiseApprovalException('The applicant password credential could not be linked to the franchise account.');
            }
            $existingUser = FranchiseUser::whereRaw('LOWER(email) = ?', [$email])->first();

            $name = trim($application->franchise_name) ?: 'Oppa Dru Franchise';
            $account = $application->franchise_account_id
                ? FranchiseAccount::whereKey($application->franchise_account_id)->lockForUpdate()->first()
                : null;
            if (! $account) {
                $account = FranchiseAccount::create([
                    'name' => $name,
                    'slug' => $this->uniqueSlug($name, FranchiseAccount::class),
                    'email' => $email,
                    'phone' => $application->phone ?: $applicant->phone,
                    'address' => $application->applicant_address,
                    'status' => 'active',
                    'owner_admin_id' => $admin?->id,
                    'metadata' => [
                        'application_id' => $application->id,
                        'application_reference' => $application->reference_number,
                    ],
                ]);
            } else {
                $account->status = 'active';
                $account->save();
            }

            if ($existingUser && $existingUser->franchise_account_id
                && (string) $existingUser->franchise_account_id !== (string) $account->id) {
                throw new FranchiseApprovalException('A franchise account already uses this applicant email. Resolve that account before approval.');
            }

            $application->forceFill([
                'franchise_applicant_id' => $applicant->id,
                'email' => $email,
                'status' => 'approved',
                'franchise_account_id' => $account->id,
                'approved_at' => $application->approved_at ?? now(),
                'approved_by_admin_id' => $application->approved_by_admin_id ?? $admin?->id,
                'reviewed_by_admin_id' => $admin?->id ?? $application->reviewed_by_admin_id,
                'reviewed_at' => $application->reviewed_at ?? now(),
                'next_step_instructions' => FranchiseApplication::defaultInstructionsFor('approved'),
                'approval_override_reason' => null,
            ])->save();

            $franchise = app(FranchiseProvisioningService::class)->provisionOnApproval($application);
            if (! $franchise) {
                throw new FranchiseApprovalException(
                    'The branch location could not be precisely geocoded. Confirm the exact branch pin on the map or provide a specific street or landmark before approval.',
                    'BRANCH_LOCATION_PIN_REQUIRED',
                );
            }

            if ($existingUser && $existingUser->franchise_id
                && (string) $existingUser->franchise_id !== (string) $franchise->id) {
                throw new FranchiseApprovalException('A franchise account already uses this applicant email. Resolve that account before approval.');
            }

            if ($existingUser) {
                $franchiseUser = $existingUser;
                $franchiseUser->forceFill([
                    'franchise_account_id' => $account->id,
                    'franchise_id' => $franchise->id,
                    'full_name' => trim($applicant->full_name),
                    'email' => $email,
                    'phone' => $applicant->phone,
                    'is_active' => true,
                    'api_token' => null,
                    'api_token_expires_at' => null,
                ])->save();
            } else {
                $franchiseUser = FranchiseUser::create([
                    'franchise_account_id' => $account->id,
                    'franchise_id' => $franchise->id,
                    'full_name' => trim($applicant->full_name),
                    'email' => $email,
                    'phone' => $applicant->phone,
                    'password' => Str::random(64),
                    'is_active' => true,
                    'can_process_pos' => false,
                ]);
            }
            DB::table('franchise_users')->where('id', $franchiseUser->id)
                ->update(['password' => $applicantPasswordHash]);
            $franchiseUser->refresh();

            $application->forceFill([
                'franchise_account_id' => $account->id,
                'franchise_id' => $franchise->id,
                'activated_at' => $application->activated_at ?? now(),
                'activated_by_admin_id' => $application->activated_by_admin_id ?? $admin?->id,
            ])->save();

            if (! $wasAlreadyApproved) {
                FranchiseApplicationEvent::create([
                    'application_id' => $application->id,
                    'actor_type' => 'admin',
                    'actor_id' => $admin?->id === null ? null : (string) $admin->id,
                    'status' => 'approved',
                    'title' => 'Application approved',
                    'message' => 'Application approved after required documents were reviewed. Franchise location and dashboard access activated.',
                    'is_internal' => false,
                    'created_at' => now(),
                ]);
            } elseif (! $alreadyHadFranchise) {
                FranchiseApplicationEvent::create([
                    'application_id' => $application->id,
                    'actor_type' => 'admin',
                    'actor_id' => $admin?->id === null ? null : (string) $admin->id,
                    'status' => 'approved',
                    'title' => 'Branch location provisioned',
                    'message' => 'The branch location was resolved and franchise dashboard access is now active.',
                    'is_internal' => false,
                    'created_at' => now(),
                ]);
            }

            if ($openingReadinessIssues !== []) {
                FranchiseApplicationEvent::create([
                    'application_id' => $application->id,
                    'actor_type' => 'admin',
                    'actor_id' => $admin?->id === null ? null : (string) $admin->id,
                    'status' => 'approved',
                    'title' => 'Opening readiness follow-up',
                    'message' => sprintf(
                        'Final approval activated dashboard access after required documents were verified. Remaining opening-readiness items from %s: %s',
                        $previousStatus,
                        implode(' ', $openingReadinessIssues),
                    ),
                    'is_internal' => true,
                    'created_at' => now(),
                ]);
            }

            return $application->fresh(['franchise', 'franchiseAccount', 'franchiseApplicant', 'events']);
        });
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

<?php

namespace App\Http\Controllers;

use App\Models\FranchiseApplicant;
use Illuminate\Http\Request;

class FranchiseApplicantEmailVerificationController extends Controller
{
    public function verify(Request $request, string $id, string $hash)
    {
        abort_unless($request->hasValidSignature(), 403, 'Invalid or expired verification link.');

        $applicant = FranchiseApplicant::findOrFail($id);
        abort_unless(
            hash_equals(sha1($applicant->getEmailForVerification()), $hash),
            403,
            'Invalid verification link.',
        );

        if (! $applicant->hasVerifiedEmail()) {
            $applicant->markEmailAsVerified();
        }

        return redirect(
            rtrim(config('app.frontend_url', env('FRONTEND_URL', '/')), '/')
            .'/franchise/applicant-login?verified=1',
        );
    }
}

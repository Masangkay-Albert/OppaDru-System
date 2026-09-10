<?php

namespace App\Http\Controllers;

use App\Exceptions\GmailApiException;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, string $id, string $hash)
    {
        abort_unless($request->hasValidSignature(), 403, 'Invalid or expired verification link.');

        $user = User::findOrFail($id);

        abort_unless(
            hash_equals(sha1($user->getEmailForVerification()), $hash),
            403,
            'Invalid verification link.'
        );

        if (!$user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return redirect(rtrim(config('app.frontend_url', env('FRONTEND_URL', '/')), '/') . '/login?verified=1');
    }

    public function resend(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim($validated['email']));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user && !$user->hasVerifiedEmail()) {
            try {
                $user->sendEmailVerificationNotification();
            } catch (GmailApiException $exception) {
                Log::error('Verification email could not be resent via Gmail API.', [
                    'user_id' => $user->id,
                    'gmail_phase' => $exception->phase(),
                    'gmail_reason' => $exception->reason(),
                    'google_payload' => $exception->payload(),
                    'exception_class' => get_class($exception),
                    'exception_message' => $exception->getMessage(),
                ]);

                return response()->json([
                    'message' => $exception->frontendMessage(),
                    'error_code' => $exception->reason(),
                ], $exception->getCode());
            } catch (\Throwable $exception) {
                Log::error('Verification email could not be resent.', [
                    'user_id' => $user->id,
                    'exception_class' => get_class($exception),
                    'exception_message' => $exception->getMessage(),
                ]);

                return response()->json([
                    'message' => 'We could not send the verification email. Please try again later.',
                ], 503);
            }

            return response()->json([
                'message' => 'Verification email accepted for delivery.',
            ]);
        }

        return response()->json([
            'message' => $user
                ? 'This email address is already verified.'
                : 'This email is not registered. Please register first.',
        ], $user ? 409 : 404);
    }
}
<?php

namespace App\Http\Controllers;

use App\Exceptions\GmailApiException;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->email))]);
        $phone = $request->input('phone');
        if (is_string($phone) && preg_match('/^\+639\d{9}$/', $phone) === 1) {
            $request->merge(['phone' => '0'.substr($phone, 3)]);
        }

        $validator = Validator::make($request->all(), [
            'full_name' => [
                'required',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'email' => [
                'required', 'string', 'email', 'max:'.config('input_limits.registration_email'),
                Rule::unique('users', 'email')->where(fn ($query) => $query->whereRaw('LOWER(email) = ?', [$request->email])),
            ],
            'phone' => ['nullable', 'string', 'max:13', 'regex:'.config('input_limits.phone')],
            'password' => ['required', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max'), 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'email_verified_at' => null,
        ]);

        try {
            $user->sendEmailVerificationNotification();
        } catch (GmailApiException $exception) {
            Log::error('Registration email could not be sent using Gmail API.', [
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
            Log::error('Registration email failed for an unexpected reason.', [
                'user_id' => $user->id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'We could not send the verification email. Please try again later.',
            ], 503);
        }

        return response()->json([
            'user' => $user->makeHidden(['password', 'api_token']),
            'message' => 'Registration successful. Please verify your email address before logging in.',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->email))]);
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email', 'max:'.config('input_limits.email')],
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$request->email])->first();

        if (!$user) {
            return response()->json([
                'message' => 'This email is not registered. Please register first.',
            ], 404);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password.'
            ], 401);
        }

        if (!$user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before logging in.',
            ], 403);
        }

        $token = Str::random(60);
        $user->api_token = hash('sha256', $token);
        $user->save();

        return response()->json([
            'user' => $user->makeHidden(['password', 'api_token']),
            'token' => $token,
            'message' => 'Login successful!'
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:'.config('input_limits.email')],
        ]);

        $email = strtolower(trim((string) $validated['email']));
        $rateLimiterKey = 'customer-forgot-password:' . $email;

        if (RateLimiter::tooManyAttempts($rateLimiterKey, 5)) {
            return response()->json([
                'message' => 'Too many password reset attempts. Please wait a moment and try again.',
            ], 429);
        }

        RateLimiter::hit($rateLimiterKey, 60);

        $user = User::whereRaw('LOWER(email) = ?', [$email])
            ->where('role', 'customer')
            ->first();

        if ($user) {
            try {
                $status = Password::broker()->sendResetLink(['email' => $user->email]);

                if ($status === Password::RESET_THROTTLED) {
                    Log::notice('Customer password reset email was throttled by the password broker.', [
                        'user_id' => $user->id,
                    ]);
                } elseif ($status === Password::RESET_LINK_SENT) {
                    Log::info('Customer password reset notification was accepted by the mail transport.', [
                        'user_id' => $user->id,
                        'mailer' => config('mail.default'),
                    ]);
                } else {
                    Log::warning('Customer password reset link was not sent by the password broker.', [
                        'user_id' => $user->id,
                        'broker_status' => $status,
                    ]);
                }
            } catch (\Throwable $exception) {
                try {
                    Password::deleteToken($user);
                } catch (\Throwable $cleanupException) {
                    Log::error('Customer password reset token cleanup failed after a mail error.', [
                        'user_id' => $user->id,
                        'exception_class' => get_class($cleanupException),
                    ]);
                }

                Log::error('Customer password reset email failed.', [
                    'user_id' => $user->id,
                    'exception_class' => get_class($exception),
                    'mail_phase' => $exception instanceof GmailApiException ? $exception->phase() : null,
                    'mail_reason' => $exception instanceof GmailApiException ? $exception->reason() : null,
                    'mailer' => config('mail.default'),
                ]);
            }
        }

        return response()->json([
            'message' => "If that email is registered, we've sent a password reset link.",
        ]);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:'.config('input_limits.email')],
            'password' => [
                'required',
                'string',
                'min:'.config('input_limits.password.min'),
                'max:'.config('input_limits.password.max'),
                'confirmed',
                'regex:/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/',
            ],
        ]);

        $email = strtolower(trim((string) $validated['email']));
        $rateLimiterKey = 'customer-reset-password:' . $email;

        if (RateLimiter::tooManyAttempts($rateLimiterKey, 10)) {
            return response()->json([
                'message' => 'Too many password reset attempts. Please wait a moment and try again.',
            ], 429);
        }

        RateLimiter::hit($rateLimiterKey, 60);

        $status = Password::broker()->reset([
            'token' => $validated['token'],
            'email' => $email,
            'password' => $validated['password'],
            'password_confirmation' => $request->input('password_confirmation'),
        ], function (User $user, string $password) {
            $user->password = Hash::make($password);
            $user->api_token = null;

            if (is_null($user->email_verified_at)) {
                $user->email_verified_at = now();
            }

            $user->save();
        });

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Password reset successful. Please sign in with your new password.',
            ]);
        }

        return response()->json([
            'message' => 'This reset link is invalid or has expired.',
        ], 422);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            $user->api_token = null;
            $user->save();
        }

        return response()->json(['message' => 'Logout successful!']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $requestedName = $request->input('full_name');
        $nameUnchanged = $request->exists('full_name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $user->full_name);
        $requestedPhone = $request->input('phone');
        if (is_string($requestedPhone) && preg_match('/^\+639\d{9}$/', $requestedPhone) === 1) {
            $requestedPhone = '0'.substr($requestedPhone, 3);
            $request->merge(['phone' => $requestedPhone]);
        }
        $phoneUnchanged = $request->exists('phone')
            && (string) $requestedPhone === (string) $user->phone;
        $nameRules = ['sometimes', 'required', 'string'];
        if ($request->exists('full_name') && ! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ];
        }
        $phoneRules = ['sometimes', 'nullable', 'string'];
        if ($request->exists('phone') && ! $phoneUnchanged) {
            $phoneRules = [...$phoneRules, 'max:13', 'regex:'.config('input_limits.phone')];
        }

        $validator = Validator::make($request->all(), [
            'full_name' => $nameRules,
            'phone' => $phoneRules,
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        if ($nameUnchanged) {
            unset($validated['full_name']);
        }
        if ($phoneUnchanged) {
            unset($validated['phone']);
        }
        $user->update($validated);

        return response()->json([
            'user' => $user,
            'message' => 'Profile updated successfully!'
        ]);
    }

    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => [
                'required',
                'string',
                'min:'.config('input_limits.password.min'),
                'max:'.config('input_limits.password.max'),
                'confirmed',
            ],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->user()->email)->first();

        if (!$user || !Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect!'
            ], 401);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json([
            'message' => 'Password changed successfully!'
        ]);
    }
}
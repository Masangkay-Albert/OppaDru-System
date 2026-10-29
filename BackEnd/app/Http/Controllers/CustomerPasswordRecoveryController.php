<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class CustomerPasswordRecoveryController extends Controller
{
    private const DUMMY_PHONE_CHECK_HASH = '$2y$12$TEpZ0DSoOjBPNtteTxACXO7667EPjGJ9tYaK1ATPy4mm0xm7Eh3ce';

    public function verify(Request $request)
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:32'],
        ]);

        $email = $validated['email'];
        [$emailKey, $ipKey] = $this->limiterKeys($email, (string) $request->ip());

        if (RateLimiter::tooManyAttempts($emailKey, 3) || RateLimiter::tooManyAttempts($ipKey, 10)) {
            $this->logRecoveryEvent('Customer password recovery verification was locked out.', $email, $request);

            return response()->json([
                'message' => 'Too many attempts. Try again in 15 minutes.',
            ], 429);
        }

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('role', 'customer')
            ->whereNotNull('email_verified_at')
            ->first();

        if (!$user || !$user->phone) {
            Hash::check('unregistered recovery account', self::DUMMY_PHONE_CHECK_HASH);
            $verified = false;
        } else {
            $storedPhone = $this->normalizePhone((string) $user->phone);
            $submittedPhone = $this->normalizePhone($validated['phone']);
            $verified = $storedPhone !== null
                && $submittedPhone !== null
                && hash_equals($storedPhone, $submittedPhone);
        }

        if (!$verified) {
            RateLimiter::hit($emailKey, 15 * 60);
            RateLimiter::hit($ipKey, 15 * 60);
            $this->logRecoveryEvent('Customer password recovery identity verification failed.', $email, $request);

            return response()->json([
                'message' => "The details you entered don't match.",
            ], 422);
        }

        RateLimiter::clear($emailKey);

        $token = Str::random(64);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            ['token' => hash('sha256', $token), 'created_at' => now()]
        );

        return response()->json(['reset_token' => $token]);
    }

    public function complete(Request $request)
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'reset_token' => ['required', 'string'],
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).+$/',
            ],
        ]);

        $email = $validated['email'];
        [$emailKey] = $this->limiterKeys($email, (string) $request->ip());

        $completed = DB::transaction(function () use ($validated, $email): bool {
            $reset = DB::table('password_reset_tokens')
                ->where('email', $email)
                ->lockForUpdate()
                ->first();

            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('role', 'customer')
                ->whereNotNull('email_verified_at')
                ->lockForUpdate()
                ->first();

            if (!$reset || !$user || !hash_equals((string) $reset->token, hash('sha256', $validated['reset_token']))) {
                return false;
            }

            if (!$reset->created_at) {
                return false;
            }

            $createdAt = Carbon::parse($reset->created_at);
            if ($createdAt->isFuture() || $createdAt->lt(now()->subMinutes(10))) {
                return false;
            }

            $user->password = Hash::make($validated['password']);
            $user->api_token = null;
            $user->save();
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return true;
        });

        if (!$completed) {
            return response()->json([
                'message' => 'This reset session is invalid or has expired. Start again.',
            ], 422);
        }

        RateLimiter::clear($emailKey);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    private function normalizePhone(string $phone): ?string
    {
        $phone = preg_replace('/[\s-]+/u', '', trim($phone));
        if (!is_string($phone)) {
            return null;
        }

        if (preg_match('/^09\d{9}$/', $phone)) {
            return $phone;
        }

        if (preg_match('/^\+?639\d{9}$/', $phone)) {
            return '0' . substr($phone, -10);
        }

        return null;
    }

    private function limiterKeys(string $email, string $ip): array
    {
        return [
            'customer-password-recovery:email:' . hash('sha256', $email),
            'customer-password-recovery:ip:' . hash('sha256', $ip),
        ];
    }

    private function logRecoveryEvent(string $message, string $email, Request $request): void
    {
        Log::notice($message, [
            'email_hash' => substr(hash('sha256', $email), 0, 12),
            'ip' => $request->ip(),
        ]);
    }
}

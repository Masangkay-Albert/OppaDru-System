<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerPasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Password1!';
    private const MISMATCH_RESPONSE = ['message' => "The details you entered don't match."];

    public function test_phone_verification_accepts_supported_philippine_formats(): void
    {
        $user = $this->createCustomer(['phone' => '+63 917-123-4567']);

        foreach ([
            '09171234567',
            '+639171234567',
            '639171234567',
            '0917 123 4567',
            '0917-123-4567',
        ] as $phone) {
            $this->postJson('/api/customer/password-reset/verify', [
                'email' => $user->email,
                'phone' => $phone,
            ])->assertOk()->assertJsonStructure(['reset_token']);
        }
    }

    public function test_all_phone_verification_failures_return_the_same_response(): void
    {
        $noPhoneUser = $this->createCustomer([
            'email' => 'nophone@example.com',
            'phone' => null,
        ]);
        $adminUser = $this->createCustomer([
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);
        $unverifiedUser = $this->createCustomer([
            'email' => 'unverified@example.com',
            'email_verified_at' => null,
        ]);
        $phoneUser = $this->createCustomer(['email' => 'wrongphone@example.com']);

        $cases = [
            ['email' => $phoneUser->email, 'phone' => '09999999999'],
            ['email' => 'missing@example.com', 'phone' => '09171234567'],
            ['email' => $adminUser->email, 'phone' => '09171234567'],
            ['email' => $unverifiedUser->email, 'phone' => '09171234567'],
            ['email' => $noPhoneUser->email, 'phone' => '09171234567'],
        ];

        foreach ($cases as $case) {
            $this->postJson('/api/customer/password-reset/verify', $case)
                ->assertStatus(422)
                ->assertExactJson(self::MISMATCH_RESPONSE);
        }
    }

    public function test_nonexistent_email_is_locked_after_three_failed_attempts(): void
    {
        $payload = [
            'email' => 'not-a-customer@example.com',
            'phone' => '09171234567',
        ];

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/customer/password-reset/verify', $payload)
                ->assertStatus(422)
                ->assertExactJson(self::MISMATCH_RESPONSE);
        }

        $this->postJson('/api/customer/password-reset/verify', $payload)
            ->assertStatus(429)
            ->assertExactJson(['message' => 'Too many attempts. Try again in 15 minutes.']);
    }

    public function test_successful_verification_resets_the_email_failure_counter(): void
    {
        $user = $this->createCustomer();
        $wrongPayload = ['email' => $user->email, 'phone' => '09999999999'];
        $correctPayload = ['email' => $user->email, 'phone' => $user->phone];

        for ($attempt = 0; $attempt < 2; $attempt++) {
            $this->postJson('/api/customer/password-reset/verify', $wrongPayload)->assertStatus(422);
        }
        $this->postJson('/api/customer/password-reset/verify', $correctPayload)->assertOk();

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/customer/password-reset/verify', $wrongPayload)
                ->assertStatus(422)
                ->assertExactJson(self::MISMATCH_RESPONSE);
        }

        $this->postJson('/api/customer/password-reset/verify', $wrongPayload)->assertStatus(429);
    }

    public function test_ip_lockout_limits_failures_across_different_emails(): void
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/customer/password-reset/verify', [
                'email' => "missing{$attempt}@example.com",
                'phone' => '09171234567',
            ])->assertStatus(422);
        }

        $this->postJson('/api/customer/password-reset/verify', [
            'email' => 'another-missing@example.com',
            'phone' => '09171234567',
        ])->assertStatus(429)
            ->assertJsonPath('message', 'Too many attempts. Try again in 15 minutes.');
    }

    public function test_valid_reset_changes_password_deletes_token_and_revokes_session(): void
    {
        $user = $this->createCustomer();
        $this->storeResetToken($user, 'valid-reset-token');

        $this->postJson('/api/customer/password-reset/complete', [
            'email' => $user->email,
            'reset_token' => 'valid-reset-token',
            'password' => 'NewPassword2!',
            'password_confirmation' => 'NewPassword2!',
        ])->assertOk();

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->assertNull($user->fresh()->api_token);
        $this->assertTrue(Hash::check('NewPassword2!', $user->fresh()->password));

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => self::PASSWORD,
        ])->assertUnauthorized();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'NewPassword2!',
        ])->assertOk()->assertJsonStructure(['user', 'token', 'message']);
    }

    public function test_complete_rejects_wrong_expired_and_reused_tokens(): void
    {
        $user = $this->createCustomer();
        $this->storeResetToken($user, 'expected-reset-token');

        $this->completeReset($user, 'wrong-reset-token')->assertStatus(422)
            ->assertExactJson(['message' => 'This reset session is invalid or has expired. Start again.']);

        Carbon::setTestNow(Carbon::parse('2026-10-29 12:00:00'));
        $this->storeResetToken($user, 'expired-reset-token', now()->subMinutes(11));
        $this->completeReset($user, 'expired-reset-token')->assertStatus(422)
            ->assertExactJson(['message' => 'This reset session is invalid or has expired. Start again.']);

        $this->storeResetToken($user, 'single-use-reset-token');
        $this->completeReset($user, 'single-use-reset-token')->assertOk();
        $this->completeReset($user, 'single-use-reset-token')->assertStatus(422)
            ->assertExactJson(['message' => 'This reset session is invalid or has expired. Start again.']);
    }

    public function test_complete_rejects_passwords_that_do_not_meet_complexity_rules(): void
    {
        $user = $this->createCustomer();
        $this->storeResetToken($user, 'valid-reset-token');

        $this->postJson('/api/customer/password-reset/complete', [
            'email' => $user->email,
            'reset_token' => 'valid-reset-token',
            'password' => 'weakpassword1',
            'password_confirmation' => 'weakpassword1',
        ])->assertStatus(422);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function createCustomer(array $overrides = []): User
    {
        $attributes = array_merge([
            'full_name' => 'Recovery Customer',
            'email' => 'customer@example.com',
            'phone' => '09171234567',
            'password' => Hash::make(self::PASSWORD),
            'role' => 'customer',
            'email_verified_at' => now(),
        ], $overrides);
        $attributes['api_token'] ??= hash('sha256', 'existing-session-token:' . $attributes['email']);

        return User::create($attributes);
    }

    private function storeResetToken(User $user, string $token, ?Carbon $createdAt = null): void
    {
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => hash('sha256', $token), 'created_at' => $createdAt ?? now()]
        );
    }

    private function completeReset(User $user, string $token)
    {
        return $this->postJson('/api/customer/password-reset/complete', [
            'email' => $user->email,
            'reset_token' => $token,
            'password' => 'AnotherPassword3!',
            'password_confirmation' => 'AnotherPassword3!',
        ]);
    }
}

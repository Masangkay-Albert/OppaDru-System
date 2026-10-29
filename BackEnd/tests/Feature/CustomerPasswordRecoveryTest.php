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
                'method' => 'phone',
                'phone' => $phone,
            ])->assertOk()->assertJsonStructure(['reset_token']);
        }
    }

    public function test_security_question_verification_normalizes_the_answer(): void
    {
        $user = $this->createCustomer([
            'security_question' => 'birth_city',
            'security_answer_hash' => Hash::make('quezon city'),
        ]);

        $this->postJson('/api/customer/password-reset/verify', [
            'email' => $user->email,
            'method' => 'question',
            'question' => 'birth_city',
            'answer' => '  QUEZON    City  ',
        ])->assertOk()->assertJsonStructure(['reset_token']);
    }

    public function test_all_identity_failures_return_the_same_response(): void
    {
        $questionUser = $this->createCustomer([
            'email' => 'question@example.com',
            'security_question' => 'first_pet',
            'security_answer_hash' => Hash::make('bingo'),
        ]);
        $noPhoneUser = $this->createCustomer([
            'email' => 'nophone@example.com',
            'phone' => null,
        ]);
        $noQuestionUser = $this->createCustomer([
            'email' => 'noquestion@example.com',
            'security_question' => null,
            'security_answer_hash' => null,
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
            ['email' => $phoneUser->email, 'method' => 'phone', 'phone' => '09999999999'],
            ['email' => $questionUser->email, 'method' => 'question', 'question' => 'first_pet', 'answer' => 'wrong'],
            ['email' => 'missing@example.com', 'method' => 'phone', 'phone' => '09171234567'],
            ['email' => $adminUser->email, 'method' => 'phone', 'phone' => '09171234567'],
            ['email' => $unverifiedUser->email, 'method' => 'phone', 'phone' => '09171234567'],
            ['email' => $noPhoneUser->email, 'method' => 'phone', 'phone' => '09171234567'],
            ['email' => $noQuestionUser->email, 'method' => 'question', 'question' => 'first_pet', 'answer' => 'bingo'],
        ];

        foreach ($cases as $case) {
            $response = $this->postJson('/api/customer/password-reset/verify', $case);
            $response->assertStatus(422)->assertExactJson(self::MISMATCH_RESPONSE);
        }
    }

    public function test_nonexistent_email_is_locked_after_three_failed_attempts(): void
    {
        $payload = [
            'email' => 'not-a-customer@example.com',
            'method' => 'phone',
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
        $wrongPayload = ['email' => $user->email, 'method' => 'phone', 'phone' => '09999999999'];
        $correctPayload = ['email' => $user->email, 'method' => 'phone', 'phone' => $user->phone];

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
                'method' => 'phone',
                'phone' => '09171234567',
            ])->assertStatus(422);
        }

        $this->postJson('/api/customer/password-reset/verify', [
            'email' => 'another-missing@example.com',
            'method' => 'phone',
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

    public function test_security_question_update_requires_current_password_and_hashes_answer(): void
    {
        $user = $this->createCustomer();
        $token = 'customer-session-token';
        $user->api_token = hash('sha256', $token);
        $user->save();
        $headers = ['Authorization' => 'Bearer ' . $token];

        $this->putJson('/api/customer/security-question', [
            'current_password' => 'incorrect',
            'question' => 'first_pet',
            'answer' => 'Mochi Cat',
        ], $headers)->assertStatus(422);

        $this->putJson('/api/customer/security-question', [
            'current_password' => self::PASSWORD,
            'question' => 'first_pet',
            'answer' => '  Mochi   Cat  ',
        ], $headers)->assertOk();

        $updated = $user->fresh();
        $this->assertSame('first_pet', $updated->security_question);
        $this->assertNotSame('mochi cat', $updated->security_answer_hash);
        $this->assertTrue(Hash::check('mochi cat', $updated->security_answer_hash));

        $this->getJson('/api/customer/security-question/status', $headers)
            ->assertOk()
            ->assertJsonPath('has_question', true)
            ->assertJsonPath('question', 'first_pet')
            ->assertJsonMissingPath('answer')
            ->assertJsonMissingPath('security_answer_hash');
    }

    public function test_question_list_exposes_only_ids_and_labels(): void
    {
        $response = $this->getJson('/api/customer/security-questions')->assertOk();
        $response->assertJsonStructure(['questions' => [['id', 'label']]]);
        $this->assertSame(
            ['first_pet', 'birth_city', 'elementary_school', 'favorite_teacher', 'childhood_nickname'],
            array_column($response->json('questions'), 'id')
        );
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

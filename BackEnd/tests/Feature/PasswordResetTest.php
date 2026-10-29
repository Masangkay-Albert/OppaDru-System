<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_sends_reset_notification_for_existing_verified_customer(): void
    {
        Notification::fake();

        $user = User::create([
            'full_name' => 'Verified Customer',
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/customer/forgot-password', [
            'email' => 'Customer@Example.com',
        ])->assertOk()
            ->assertJsonPath('message', "If that email is registered, we've sent a password reset link.");

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_forgot_password_returns_generic_response_for_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/customer/forgot-password', [
            'email' => 'missing@example.com',
        ])->assertOk()
            ->assertJsonPath('message', "If that email is registered, we've sent a password reset link.");

        Notification::assertNothingSent();
    }

    public function test_forgot_password_does_not_send_for_non_customer_role_rows(): void
    {
        Notification::fake();

        $admin = User::create([
            'full_name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => 'Password1!',
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/customer/forgot-password', [
            'email' => 'admin@example.com',
        ])->assertOk();

        Notification::assertNotSentTo($admin, ResetPasswordNotification::class);
    }

    public function test_reset_password_succeeds_with_valid_token_and_revokes_existing_session(): void
    {
        $user = User::create([
            'full_name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'role' => 'customer',
            'email_verified_at' => now(),
            'api_token' => hash('sha256', 'old-token'),
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/customer/reset-password', [
            'token' => $token,
            'email' => 'customer@example.com',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk()
            ->assertJsonPath('message', 'Password reset successful. Please sign in with your new password.');

        $user->refresh();

        $this->assertTrue(Hash::check('NewPassword1!', $user->password));
        $this->assertNull($user->api_token);
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => $user->email,
        ]);
    }

    public function test_reset_password_fails_with_invalid_or_expired_token(): void
    {
        $user = User::create([
            'full_name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/customer/reset-password', [
            'token' => 'invalid-token',
            'email' => $user->email,
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'This reset link is invalid or has expired.');
    }

    public function test_reset_password_fails_with_weak_password(): void
    {
        $user = User::create([
            'full_name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/customer/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(422);
    }

    public function test_old_password_no_longer_works_and_new_password_logs_in(): void
    {
        $user = User::create([
            'full_name' => 'Customer',
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/customer/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertStatus(401);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'NewPassword1!',
        ])->assertOk()
            ->assertJsonStructure(['user', 'token', 'message']);
    }

    public function test_forgot_password_throttling_returns_429_after_limit(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/customer/forgot-password', [
                'email' => 'blocked@example.com',
            ])->assertOk();
        }

        $this->postJson('/api/customer/forgot-password', [
            'email' => 'blocked@example.com',
        ])->assertStatus(429);
    }
}

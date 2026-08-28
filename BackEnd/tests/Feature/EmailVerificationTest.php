<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyUserEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_users_are_unverified_by_default(): void
    {
        $user = User::create([
            'full_name' => 'New Customer',
            'email' => 'new@example.com',
            'password' => 'Password1!',
        ]);

        $this->assertNull($user->email_verified_at);
    }

    public function test_registration_accepts_non_gmail_email_without_logging_in(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/register', [
            'full_name' => 'Yahoo Customer',
            'email' => 'Customer@Yahoo.com',
            'phone' => '09171234567',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        $response->assertCreated()
            ->assertJsonMissingPath('token')
            ->assertJsonPath('user.email', 'customer@yahoo.com');

        $user = User::where('email', 'customer@yahoo.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        $this->assertNull($user->api_token);
        Notification::assertSentTo($user, VerifyUserEmail::class);
    }

    public function test_unverified_user_cannot_login_until_the_signed_link_is_used(): void
    {
        Notification::fake();
        $user = User::create([
            'full_name' => 'Unverified Customer',
            'email' => 'unverified@outlook.com',
            'password' => 'Password1!',
            'email_verified_at' => null,
        ]);

        $this->postJson('/api/login', [
            'email' => 'UNVERIFIED@OUTLOOK.COM',
            'password' => 'Password1!',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'Please verify your email address before logging in.');

        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->get($url)->assertRedirectContains('/login?verified=1');
        $this->assertNotNull($user->fresh()->email_verified_at);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk()->assertJsonStructure(['user', 'token', 'message']);
    }

    public function test_login_reports_when_email_is_not_registered(): void
    {
        $this->postJson('/api/login', [
            'email' => 'missing@example.com',
            'password' => 'Password1!',
        ])->assertNotFound()
            ->assertJsonPath('message', 'This email is not registered. Please register first.');
    }
}
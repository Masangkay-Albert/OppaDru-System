<?php

namespace Tests\Feature;

use App\Exceptions\GmailApiException;
use Tests\TestCase;

class GmailApiErrorHandlingTest extends TestCase
{
    public function test_invalid_grant_is_classified_as_oauth_refresh_failure(): void
    {
        $exception = GmailApiException::fromGoogleApiError('token_refresh', [
            'error' => 'invalid_grant',
            'error_description' => 'Token has been expired or revoked.',
        ]);

        $this->assertSame('token_expired_or_revoked', $exception->reason());
        $this->assertStringContainsString('re-authenticate the Gmail integration', $exception->frontendMessage());
    }

    public function test_invalid_recipient_is_classified_for_frontend(): void
    {
        $exception = GmailApiException::fromGoogleApiError('send_email', [
            'error' => [
                'code' => 400,
                'message' => 'The email address is invalid.',
            ],
        ]);

        $this->assertSame('invalid_recipient', $exception->reason());
        $this->assertStringContainsString('invalid recipient', strtolower($exception->frontendMessage()));
    }
}

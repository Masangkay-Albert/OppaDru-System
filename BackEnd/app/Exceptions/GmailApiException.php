<?php

namespace App\Exceptions;

class GmailApiException extends \RuntimeException
{
    protected string $phase;

    protected string $reason;

    protected array $payload;

    public function __construct(
        string $message,
        string $phase,
        string $reason,
        array $payload = [],
        int $code = 503,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);

        $this->phase = $phase;
        $this->reason = $reason;
        $this->payload = $payload;
    }

    public static function fromGoogleApiError(string $phase, array $payload, ?\Throwable $previous = null): self
    {
        $errorPayload = $payload['error'] ?? $payload;

        $googleMessage = is_array($errorPayload)
            ? ($errorPayload['message'] ?? $errorPayload['error_description'] ?? $errorPayload['error'] ?? 'unknown Google API error')
            : (string) $errorPayload;

        $combined = strtolower(json_encode($payload, JSON_THROW_ON_ERROR));
        $reason = self::normalizeReason($phase, $combined, $googleMessage);

        return new self(
            sprintf(
                'Gmail %s failed: %s',
                $phase === 'token_refresh' ? 'OAuth refresh' : 'send request',
                $googleMessage,
            ),
            $phase,
            $reason,
            $payload,
            self::statusCodeForReason($reason),
            $previous,
        );
    }

    public function phase(): string
    {
        return $this->phase;
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function payload(): array
    {
        return $this->payload;
    }

    public function frontendMessage(): string
    {
        return match ($this->reason) {
            'token_expired_or_revoked', 'token_refresh_failed' => 'The Gmail refresh token is expired or invalid. Please re-authenticate the Gmail integration and try again.',
            'unauthorized_client' => 'Google rejected the Gmail OAuth client configuration. Please confirm the app is authorized and the OAuth consent screen is published or the test user is allowed.',
            'insufficient_scope' => 'The Gmail OAuth token is missing the required gmail.send permission. Please re-authorize the app with the Gmail send scope.',
            'invalid_recipient' => 'Invalid recipient address. The email address was rejected by Gmail. Please check the user email address.',
            'network_timeout' => 'The Gmail API timed out or is temporarily unavailable. Please try again in a moment.',
            default => 'We could not send the verification email. Please try again later.',
        };
    }

    protected static function normalizeReason(string $phase, string $combined, string $message): string
    {
        $lowerMessage = strtolower($message);
        $lowerCombined = strtolower($combined);

        if (str_contains($lowerCombined, 'invalid_grant')
            || str_contains($lowerMessage, 'expired or revoked')
            || str_contains($lowerMessage, 'token has been expired')
            || str_contains($lowerMessage, 'refresh token')) {
            return 'token_expired_or_revoked';
        }

        if (str_contains($lowerCombined, 'unauthorized_client') || str_contains($lowerMessage, 'unauthorized_client')) {
            return 'unauthorized_client';
        }

        if (str_contains($lowerCombined, 'insufficient permissions')
            || str_contains($lowerCombined, 'gmail.send')
            || str_contains($lowerMessage, 'scope')) {
            return 'insufficient_scope';
        }

        if (str_contains($lowerCombined, 'invalid recipient')
            || str_contains($lowerCombined, 'recipient address')
            || str_contains($lowerMessage, 'address is invalid')) {
            return 'invalid_recipient';
        }

        if (str_contains($lowerCombined, 'timed out')
            || str_contains($lowerCombined, 'timeout')
            || str_contains($lowerMessage, 'network')
            || str_contains($lowerCombined, 'connection reset')) {
            return 'network_timeout';
        }

        if ($phase === 'token_refresh') {
            return 'token_refresh_failed';
        }

        return 'send_failed';
    }

    protected static function statusCodeForReason(string $reason): int
    {
        return match ($reason) {
            'invalid_recipient' => 422,
            default => 503,
        };
    }
}

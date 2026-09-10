<?php

namespace App\Mail;

use App\Exceptions\GmailApiException;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;

class GmailApiTransport extends AbstractTransport
{
    protected string $clientId;
    protected string $clientSecret;
    protected string $refreshToken;

    public function __construct(string $clientId, string $clientSecret, string $refreshToken)
    {
        parent::__construct();

        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->refreshToken = $refreshToken;
    }

    protected function doSend(SentMessage $message): void
    {
        try {
            $accessToken = $this->getAccessToken();

            $rawMime = $message->toString();
            $base64Url = rtrim(strtr(base64_encode($rawMime), '+/', '-_'), '=');

            $httpClient = new GuzzleClient();

            try {
                $response = $httpClient->post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', [
                    'http_errors' => false,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $accessToken,
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'raw' => $base64Url,
                    ],
                    'timeout' => 30,
                ]);
            } catch (\Throwable $e) {
                throw GmailApiException::fromGoogleApiError('send_email', [
                    'error' => [
                        'message' => $e->getMessage(),
                        'type' => 'network_exception',
                    ],
                ], $e);
            }

            $payload = json_decode((string) $response->getBody(), true);

            if (isset($payload['error'])) {
                throw GmailApiException::fromGoogleApiError('send_email', $payload);
            }

            Log::info('Gmail API send request succeeded', [
                'message_id' => $payload['id'] ?? null,
                'thread_id' => $payload['threadId'] ?? null,
            ]);
        } catch (GmailApiException $e) {
            Log::error('Gmail API send failed', [
                'phase' => $e->phase(),
                'reason' => $e->reason(),
                'google_payload' => $e->payload(),
                'message' => $e->getMessage(),
            ]);

            throw $e;
        } catch (\Throwable $e) {
            $wrapped = GmailApiException::fromGoogleApiError('send_email', [
                'error' => ['message' => $e->getMessage()],
            ], $e);

            Log::error('Gmail API send failed unexpectedly', [
                'phase' => 'send_email',
                'reason' => $wrapped->reason(),
                'message' => $wrapped->getMessage(),
            ]);

            throw $wrapped;
        }
    }

    protected function getAccessToken(): string
    {
        $httpClient = new GuzzleClient();

        try {
            $response = $httpClient->post('https://oauth2.googleapis.com/token', [
                'http_errors' => false,
                'form_params' => [
                    'client_id' => $this->clientId,
                    'client_secret' => $this->clientSecret,
                    'refresh_token' => $this->refreshToken,
                    'grant_type' => 'refresh_token',
                ],
                'timeout' => 30,
            ]);
        } catch (\Throwable $e) {
            $wrapped = GmailApiException::fromGoogleApiError('token_refresh', [
                'error' => ['message' => $e->getMessage(), 'type' => 'network_exception'],
            ], $e);

            Log::error('Gmail OAuth refresh failed before contacting Google', [
                'phase' => 'token_refresh',
                'reason' => $wrapped->reason(),
                'message' => $wrapped->getMessage(),
            ]);

            throw $wrapped;
        }

        $data = json_decode((string) $response->getBody(), true);

        if (empty($data['access_token'])) {
            $wrapped = GmailApiException::fromGoogleApiError('token_refresh', $data ?: [
                'error' => ['message' => 'No access token returned by Google OAuth.'],
            ]);

            Log::error('Gmail OAuth refresh returned an error', [
                'phase' => 'token_refresh',
                'reason' => $wrapped->reason(),
                'google_payload' => $wrapped->payload(),
                'message' => $wrapped->getMessage(),
            ]);

            throw $wrapped;
        }

        Log::info('Gmail OAuth refresh succeeded', [
            'expires_in' => $data['expires_in'] ?? null,
            'scope' => $data['scope'] ?? null,
        ]);

        return $data['access_token'];
    }

    public function __toString(): string
    {
        return 'gmail+api';
    }
}
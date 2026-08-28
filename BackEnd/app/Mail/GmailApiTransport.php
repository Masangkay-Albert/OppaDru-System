<?php

namespace App\Mail;

use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use GuzzleHttp\Client as GuzzleClient;

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
        $accessToken = $this->getAccessToken();

        $rawMime = $message->toString();
        $base64Url = rtrim(strtr(base64_encode($rawMime), '+/', '-_'), '=');

        $httpClient = new GuzzleClient();

        $httpClient->post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', [
            'headers' => [
                'Authorization' => 'Bearer ' . $accessToken,
                'Content-Type' => 'application/json',
            ],
            'json' => [
                'raw' => $base64Url,
            ],
        ]);
    }

    protected function getAccessToken(): string
    {
        $httpClient = new GuzzleClient();

        $response = $httpClient->post('https://oauth2.googleapis.com/token', [
            'form_params' => [
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token',
            ],
        ]);

        $data = json_decode((string) $response->getBody(), true);

        return $data['access_token'];
    }

    public function __toString(): string
    {
        return 'gmail+api';
    }
}
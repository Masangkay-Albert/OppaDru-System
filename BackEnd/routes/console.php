<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('mail:test {recipient}', function (string $recipient) {
    $this->info('Mailer: '.config('mail.default'));
    $this->info('Host: '.config('mail.mailers.smtp.host'));
    $this->info('Port: '.config('mail.mailers.smtp.port'));
    $this->info('Username: '.config('mail.mailers.smtp.username'));
    $this->info('From: '.config('mail.from.address'));

    try {
        Mail::raw('This is a real production mail delivery test from Oppa Dru.', function ($message) use ($recipient) {
            $message->to($recipient)->subject('Oppa Dru mail delivery test');
        });
    } catch (\Throwable $exception) {
        Log::error('Production mail test failed.', [
            'recipient' => $recipient,
            'exception_class' => get_class($exception),
            'exception_message' => $exception->getMessage(),
        ]);
        $this->error('Mail delivery failed. Check the Render logs for the exception details.');
        $this->error('Mail delivery failed: ' . $exception->getMessage());
        return 1;
    }

    $this->info('Mail was accepted by the configured transport. Check the recipient inbox.');
    return 0;
})->purpose('Send a real email through the configured production mailer');

Artisan::command('gmail:token {--code= : Optional authorization code directly from browser}', function () {
    $clientId = config('services.gmail.client_id');
    $clientSecret = config('services.gmail.client_secret');
    $redirectUri = 'http://127.0.0.1:8000';

    if (empty($clientId) || empty($clientSecret)) {
        $this->error('GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing in .env');
        return 1;
    }

    $code = $this->option('code');

    if (empty($code)) {
        $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/gmail.send',
            'access_type' => 'offline',
            'prompt' => 'consent',
        ]);

        $this->info('================================================================');
        $this->info('STEP 1: Open the authorization URL in your browser:');
        $this->line($authUrl);
        $this->info('================================================================');
        $this->comment('Sign in with your Gmail account (e.g. oppadrusystem01@gmail.com) and click "Allow".');
        $this->info('Waiting for authorization on http://127.0.0.1:8000 (up to 90 seconds)...');

        $server = @stream_socket_server('tcp://127.0.0.1:8000', $errno, $errstr);
        if ($server) {
            stream_set_timeout($server, 90);
            $client = @stream_socket_accept($server, 90);
            if ($client) {
                $request = fread($client, 2048);
                if (preg_match('/GET \/[?]([^ ]*) HTTP/', $request, $matches)) {
                    parse_str($matches[1], $query);
                    $code = $query['code'] ?? null;
                }

                $html = '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;">'
                    . '<h2 style="color:#059669;">Authorization Successful!</h2>'
                    . '<p>You may now close this tab and return to your terminal.</p>'
                    . '</body></html>';
                $response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n" . $html;
                fwrite($client, $response);
                fclose($client);
            }
            fclose($server);
        }

        if (empty($code)) {
            $input = $this->ask('If browser redirected to 127.0.0.1:8000 with a code parameter, paste code or full URL here');
            if (empty($input)) {
                $this->error('No authorization code provided. Aborted.');
                return 1;
            }

            if (str_contains($input, 'code=')) {
                $parsed = parse_url($input);
                parse_str($parsed['query'] ?? '', $q);
                $code = $q['code'] ?? $input;
            } else {
                $code = trim($input);
            }
        }
    }

    $this->info('Exchanging authorization code with Google OAuth endpoint...');

    $httpClient = new \GuzzleHttp\Client(['timeout' => 30]);

    try {
        $response = $httpClient->post('https://oauth2.googleapis.com/token', [
            'form_params' => [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $code,
                'grant_type' => 'authorization_code',
                'redirect_uri' => $redirectUri,
            ],
        ]);
    } catch (\Throwable $e) {
        $this->error('Token exchange failed: ' . $e->getMessage());
        return 1;
    }

    $data = json_decode((string) $response->getBody(), true);
    $refreshToken = $data['refresh_token'] ?? null;

    if (empty($refreshToken)) {
        $this->warn('Google did not return a new refresh token. Google only returns a refresh token on the first consent or when prompt=consent is used.');
        $this->line(json_encode($data, JSON_PRETTY_PRINT));
        return 1;
    }

    $this->info('Success! New Refresh Token generated and cryptographically bound to your Client ID:');
    $this->line($refreshToken);

    // Automatically update .env file
    $envPath = base_path('.env');
    if (file_exists($envPath)) {
        $envContent = file_get_contents($envPath);
        if (str_contains($envContent, 'GMAIL_REFRESH_TOKEN=')) {
            $envContent = preg_replace('/GMAIL_REFRESH_TOKEN=.*/', 'GMAIL_REFRESH_TOKEN=' . $refreshToken, $envContent);
        } else {
            $envContent .= "\nGMAIL_REFRESH_TOKEN=" . $refreshToken;
        }
        file_put_contents($envPath, $envContent);
        $this->info('.env updated successfully.');
    }

    \Illuminate\Support\Facades\Cache::flush();

    $this->info('================================================================');
    $this->info('RENDER DEPLOYMENT INSTRUCTION:');
    $this->info('Copy and paste this new GMAIL_REFRESH_TOKEN value into your Render.com Environment Variables:');
    $this->line($refreshToken);
    $this->info('================================================================');

    return 0;
})->purpose('Generate and bind a new Gmail API refresh token for your OAuth client');

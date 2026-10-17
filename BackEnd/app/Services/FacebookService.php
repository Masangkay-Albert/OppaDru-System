<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class FacebookService
{
    protected ?string $pageId;
    protected ?string $pageAccessToken;
    protected string $apiVersion;

    public function __construct(?string $pageId = null, ?string $pageAccessToken = null)
    {
        $this->pageId = $pageId ?: config('services.facebook.page_id');
        $this->pageAccessToken = $pageAccessToken ?: config('services.facebook.page_access_token');
        $this->apiVersion = config('services.facebook.api_version', 'v26.0');
    }

    /**
     * Check if Facebook credentials are configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->pageId) && !empty($this->pageAccessToken);
    }

    /**
     * Get the current status/info of the configured Facebook Page.
     */
    public function getStatus(): array
    {
        if (!$this->isConfigured()) {
            return [
                'configured' => false,
                'page_id' => $this->pageId,
                'message' => 'Facebook Page ID or Page Access Token is missing.',
            ];
        }

        try {
            $response = Http::withToken($this->pageAccessToken)
                ->timeout(10)
                ->get("https://graph.facebook.com/{$this->apiVersion}/{$this->pageId}", [
                    'fields' => 'id,name,link,picture{url}',
                ]);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'configured' => true,
                    'connected' => true,
                    'page_id' => $data['id'] ?? $this->pageId,
                    'page_name' => $data['name'] ?? 'Facebook Business Page',
                    'page_link' => $data['link'] ?? "https://facebook.com/{$this->pageId}",
                    'page_picture' => $data['picture']['data']['url'] ?? null,
                ];
            }

            $error = $response->json('error.message') ?? 'Invalid token or page ID';
            return [
                'configured' => true,
                'connected' => false,
                'page_id' => $this->pageId,
                'error' => $error,
            ];
        } catch (ConnectionException $e) {
            Log::error('Facebook status request failed', ['error' => $e->getMessage()]);
            return [
                'configured' => true,
                'connected' => false,
                'page_id' => $this->pageId,
                'error' => 'Unable to connect to Facebook. Check the backend network connection and try again.',
            ];
        }
    }

    /**
     * Publish an announcement with text and optional image to Facebook.
     */
    public function publish(string $message, ?string $imagePath = null, ?string $imageUrl = null): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'message' => 'Facebook is not configured. Set the Page Access Token in the backend environment.',
            ];
        }

        $endpoint = "https://graph.facebook.com/{$this->apiVersion}/{$this->pageId}";
        $payload = ['caption' => $message, 'access_token' => $this->pageAccessToken];

        try {
            if ($imagePath !== null) {
                if (!Storage::disk('public')->exists($imagePath)) {
                    return $this->failure('The announcement image could not be found on the server.');
                }

                $filePath = Storage::disk('public')->path($imagePath);
                if (!is_readable($filePath)) {
                    return $this->failure('The announcement image could not be read from the server.');
                }

                $fileContents = file_get_contents($filePath);
                if ($fileContents === false) {
                    return $this->failure('The announcement image could not be read from the server.');
                }

                $response = Http::timeout(30)
                    ->attach('source', $fileContents, basename($filePath))
                    ->post("{$endpoint}/photos", $payload);
            } elseif ($imageUrl !== null && $imageUrl !== '') {
                $imageScheme = parse_url($imageUrl, PHP_URL_SCHEME);
                if (!filter_var($imageUrl, FILTER_VALIDATE_URL) || !in_array($imageScheme, ['http', 'https'], true)) {
                    return $this->failure('The announcement image URL must be a valid HTTP or HTTPS URL.');
                }

                $response = Http::asForm()->timeout(30)->post("{$endpoint}/photos", [
                    'url' => $imageUrl,
                    ...$payload,
                ]);
            } else {
                $response = Http::asForm()->timeout(20)->post("{$endpoint}/feed", [
                    'message' => $message,
                    'access_token' => $this->pageAccessToken,
                ]);
            }

            if ($response->successful()) {
                $data = $response->json();
                $postId = $data['post_id'] ?? $data['id'] ?? null;
                $postUrl = $postId
                    ? "https://www.facebook.com/{$postId}"
                    : "https://www.facebook.com/{$this->pageId}";

                return [
                    'success' => true,
                    'post_id' => $postId,
                    'post_url' => $postUrl,
                ];
            }

            $errorMessage = $response->json('error.message') ?? 'Facebook API rejected post request.';
            Log::error('Facebook publish failed', ['response' => $response->json()]);

            return [
                'success' => false,
                'message' => $errorMessage,
            ];
        } catch (ConnectionException $e) {
            Log::error('Facebook publish exception', ['error' => $e->getMessage()]);
            return $this->failure('Unable to connect to Facebook. Check the backend network connection and try again.');
        }
    }

    private function failure(string $message): array
    {
        Log::error('Facebook publish failed', ['message' => $message]);
        return ['success' => false, 'message' => $message];
    }
}

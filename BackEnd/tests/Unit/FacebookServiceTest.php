<?php

namespace Tests\Unit;

use App\Services\FacebookService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FacebookServiceTest extends TestCase
{
    public function test_it_uses_facebook_credentials_from_service_configuration(): void
    {
        config([
            'services.facebook.page_id' => 'configured-page',
            'services.facebook.page_access_token' => 'configured-token',
        ]);
        Http::fake([
            'graph.facebook.com/*' => Http::response(['id' => 'configured-page_post_456'], 200),
        ]);

        $result = (new FacebookService())->publish('Configured page announcement.');

        $this->assertTrue($result['success']);
        Http::assertSent(fn (Request $request) =>
            $request->url() === 'https://graph.facebook.com/v26.0/configured-page/feed'
            && $request['access_token'] === 'configured-token'
        );
    }

    public function test_it_publishes_text_to_the_configured_page_feed(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['id' => 'page_123_post_456'], 200),
        ]);

        $result = (new FacebookService('page-123', 'page-token'))->publish('Store closes early today.');

        $this->assertTrue($result['success']);
        $this->assertSame('https://www.facebook.com/page_123_post_456', $result['post_url']);
        Http::assertSent(fn (Request $request) =>
            $request->url() === 'https://graph.facebook.com/v26.0/page-123/feed'
            && $request['message'] === 'Store closes early today.'
            && $request['access_token'] === 'page-token'
        );
    }

    public function test_it_uploads_an_announcement_image_as_a_page_photo(): void
    {
        $imagePath = tempnam(sys_get_temp_dir(), 'facebook-image-');
        file_put_contents($imagePath, 'image-bytes');
        $disk = \Mockery::mock();
        $disk->shouldReceive('exists')->once()->with('announcements/test.png')->andReturn(true);
        $disk->shouldReceive('path')->once()->with('announcements/test.png')->andReturn($imagePath);
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'id' => 'photo-123',
                'post_id' => 'page-123_post-456',
            ], 200),
        ]);

        try {
            $result = (new FacebookService('page-123', 'page-token'))
                ->publish('New menu item', 'announcements/test.png');

            $this->assertTrue($result['success']);
            Http::assertSent(fn (Request $request) =>
                str_ends_with($request->url(), '/page-123/photos')
                && $request->hasFile('source')
                && str_contains($request->body(), 'New menu item')
            );
        } finally {
            unlink($imagePath);
        }
    }

    public function test_it_does_not_publish_text_when_the_announcement_image_is_missing(): void
    {
        $disk = \Mockery::mock();
        $disk->shouldReceive('exists')->once()->with('announcements/missing.png')->andReturn(false);
        Storage::shouldReceive('disk')->once()->with('public')->andReturn($disk);
        Http::fake();

        $result = (new FacebookService('page-123', 'page-token'))
            ->publish('Announcement text', 'announcements/missing.png');

        $this->assertFalse($result['success']);
        Http::assertNothingSent();
    }

    public function test_it_explains_that_publish_actions_is_deprecated(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'message' => 'The permission(s) publish_actions are not available. It has been deprecated.',
                ],
            ], 400),
        ]);

        $result = (new FacebookService('page-123', 'page-token'))->publish('Announcement text');

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Generate a new Page Access Token', $result['message']);
        $this->assertStringContainsString('without requesting publish_actions', $result['message']);
    }
}

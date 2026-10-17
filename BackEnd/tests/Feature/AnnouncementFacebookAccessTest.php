<?php

namespace Tests\Feature;

use Tests\TestCase;

class AnnouncementFacebookAccessTest extends TestCase
{
    public function test_facebook_announcement_actions_require_admin_authentication(): void
    {
        $this->postJson('/api/admin/announcements', [
            'title' => 'Unauthorized post',
            'content' => 'This should not be created.',
            'publish_to_facebook' => true,
        ])->assertUnauthorized();

        $this->getJson('/api/admin/facebook/status')->assertUnauthorized();
    }
}

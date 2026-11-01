<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Promo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromoImagePersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_promo_listing_and_image_require_admin_authentication(): void
    {
        $imageData = 'data:image/png;base64,'.base64_encode('promo-image-content');
        $promo = Promo::create([
            'title' => 'Persistent promo image',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'image' => $imageData,
            'is_active' => true,
        ]);

        $this->get('/api/promos')->assertNotFound();
        $this->get('/api/admin/promos/'.$promo->id)->assertUnauthorized();
        $this->get('/api/admin/promos/'.$promo->id.'/image')->assertUnauthorized();

        $token = 'test-admin-token';
        Admin::create([
            'full_name' => 'Promo Admin',
            'email' => 'promo-admin@example.com',
            'password' => 'password',
            'api_token' => hash('sha256', $token),
        ]);

        $this->withToken($token)->get('/api/admin/promos/'.$promo->id.'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertContent('promo-image-content');

        $this->withToken($token)->get('/api/admin/promos')
            ->assertOk()
            ->assertJsonPath('0.image_url', url('/api/admin/promos/'.$promo->id.'/image').'?v='.substr(hash('sha256', $imageData), 0, 16));
    }
}

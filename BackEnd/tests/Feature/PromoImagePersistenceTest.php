<?php

namespace Tests\Feature;

use App\Models\Promo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromoImagePersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_saved_promo_image_is_served_from_the_database_and_exposed_as_an_image_url(): void
    {
        $imageData = 'data:image/png;base64,'.base64_encode('promo-image-content');
        $promo = Promo::create([
            'title' => 'Persistent promo image',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'image' => $imageData,
            'is_active' => true,
        ]);

        $this->get('/api/promos/'.$promo->id.'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertContent('promo-image-content');

        $this->get('/api/promos')
            ->assertOk()
            ->assertJsonPath('0.image_url', url('/api/promos/'.$promo->id.'/image').'?v='.substr(hash('sha256', $imageData), 0, 16));
    }
}

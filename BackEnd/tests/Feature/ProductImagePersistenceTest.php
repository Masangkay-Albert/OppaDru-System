<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\ProductImageUploadService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ProductImagePersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_upload_returns_image_data_that_can_be_saved_in_the_database(): void
    {
        $upload = UploadedFile::fake()->createWithContent('menu.png', "\x89PNG\r\n\x1a\n".str_repeat("\0", 16));

        $result = app(ProductImageUploadService::class)->uploadFromRequest($upload, 'chicken');

        $this->assertTrue($result['success']);
        $this->assertStringStartsWith('data:image/png;base64,', $result['url']);
    }

    public function test_saved_product_image_is_served_without_embedding_image_data_in_product_json(): void
    {
        $imageData = 'data:image/png;base64,'.base64_encode('test-image-content');
        $product = Product::create([
            'name' => 'Persistent product image',
            'description' => 'Test product',
            'price' => 100,
            'category' => 'chicken',
            'image' => $imageData,
            'is_available' => true,
        ]);

        $this->assertSame(url('/api/products/'.$product->id.'/image'), $product->toArray()['image']);

        $this->get('/api/products/'.$product->id.'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertContent('test-image-content');
    }
}

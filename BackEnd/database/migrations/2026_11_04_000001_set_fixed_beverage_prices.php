<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PRODUCT_PRICES = [
        ['id' => '5c099990-e681-4f31-84a9-b2094b4203d6', 'category' => 'fruity-soda-milk', 'price' => '110.00'],
        ['id' => '78d72293-e33c-4e53-9778-fcade3697613', 'category' => 'fruity-soda-milk', 'price' => '99.00'],
        ['id' => 'da25a8c7-325e-4b21-a9a3-1aeb398dfe2f', 'category' => 'fruity-soda-milk', 'price' => '99.00'],
        ['id' => '708038a1-f992-428f-9477-d8c4d12af70c', 'category' => 'fruity-soda-milk', 'price' => '99.00'],
        ['id' => '82ba75ff-a5a7-4afc-b28a-0d0a2f492d40', 'category' => 'fruity-soda-milk', 'price' => '110.00'],
        ['id' => 'fbffe76e-d396-44e2-9f4b-d71723cc9dcf', 'category' => 'fruity-soda-milk', 'price' => '99.00'],
        ['id' => '35d9f15c-4a43-47e4-8dbf-cf1224ec8b37', 'category' => 'fruity-soda-milk', 'price' => '110.00'],
        ['id' => '22395ceb-a2f8-4f09-952e-44b7eacd0fcb', 'category' => 'fruity-soda-milk', 'price' => '99.00'],
        ['id' => 'PROD-xgCLVaFE-VWBT', 'category' => 'fresh-lemonade', 'price' => '150.00'],
        ['id' => 'ed786887-673f-47dc-bc30-8205ea000c25', 'category' => 'fresh-lemonade', 'price' => '145.00'],
        ['id' => 'ed70afbb-9eac-4e60-80b7-0350e4e56205', 'category' => 'fresh-lemonade', 'price' => '155.00'],
        ['id' => 'c637187f-3295-4eea-8aa0-4eec054f5a33', 'category' => 'fresh-lemonade', 'price' => '85.00'],
        ['id' => '510ae849-3c61-4c82-8115-f5f7b4237a40', 'category' => 'fresh-lemonade', 'price' => '145.00'],
        ['id' => '26cceb54-82ab-4b60-bdb8-2c96eaa6bfe9', 'category' => 'fresh-lemonade', 'price' => '165.00'],
        ['id' => '894de519-44ec-48a5-a0bc-a6cd216f955e', 'category' => 'fresh-lemonade', 'price' => '155.00'],
        ['id' => 'afa40a04-5598-4972-a68a-5c76d0e6bd0b', 'category' => 'fresh-lemonade', 'price' => '175.00'],
        ['id' => '42713981-e2e7-4255-b80e-f81b319cdea2', 'category' => 'fresh-lemonade', 'price' => '145.00'],
    ];

    public function up(): void
    {
        foreach (self::PRODUCT_PRICES as $product) {
            DB::table('products')
                ->where('id', $product['id'])
                ->where('category', $product['category'])
                ->where('price', $product['price'])
                ->update(['price' => 99, 'updated_at' => now()]);
        }

        $this->updateDrinksCategoryApplicability(false);
    }

    public function down(): void
    {
        foreach (self::PRODUCT_PRICES as $product) {
            DB::table('products')
                ->where('id', $product['id'])
                ->where('category', $product['category'])
                ->where('price', 99)
                ->update(['price' => $product['price'], 'updated_at' => now()]);
        }

        $this->updateDrinksCategoryApplicability(true);
    }

    private function updateDrinksCategoryApplicability(bool $restore): void
    {
        $groups = DB::table('addon_groups')
            ->where('name', 'Drinks')
            ->whereNull('franchise_id')
            ->get(['id', 'applicable_categories']);

        foreach ($groups as $group) {
            $categories = json_decode((string) $group->applicable_categories, true);
            if (! is_array($categories)) {
                throw new RuntimeException("The Drinks add-on group {$group->id} has invalid category configuration.");
            }

            if ($restore) {
                if (! in_array('fruity-soda-milk', $categories, true)) {
                    $categories[] = 'fruity-soda-milk';
                }
            } else {
                $categories = array_values(array_filter(
                    $categories,
                    fn (string $category) => $category !== 'fruity-soda-milk',
                ));
            }

            DB::table('addon_groups')
                ->where('id', $group->id)
                ->update([
                    'applicable_categories' => json_encode($categories),
                    'updated_at' => now(),
                ]);
        }
    }
};

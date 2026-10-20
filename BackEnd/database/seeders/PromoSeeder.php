<?php

namespace Database\Seeders;

use App\Models\Promo;
use Illuminate\Database\Seeder;

class PromoSeeder extends Seeder
{
    public function run(): void
    {
        $promos = [
            [
                'id' => 'OPPA-PRM-OPPA10',
                'code' => 'OPPA10',
                'title' => '🎉 10% Welcome Discount',
                'description' => 'Enjoy 10% off your entire order with no minimum spend.',
                'discount_type' => 'percent',
                'discount_value' => 10,
                'min_order_amount' => 0,
                'max_discount_amount' => 500,
                'is_active' => true,
                'start_date' => now()->subDay(),
                'end_date' => now()->addYear(),
            ],
            [
                'id' => 'OPPA-PRM-OPPA20',
                'code' => 'OPPA20',
                'title' => '🔥 20% Big Feast Savings',
                'description' => 'Get 20% off when you order ₱1,000 or more.',
                'discount_type' => 'percent',
                'discount_value' => 20,
                'min_order_amount' => 1000,
                'max_discount_amount' => 1000,
                'is_active' => true,
                'start_date' => now()->subDay(),
                'end_date' => now()->addYear(),
            ],
            [
                'id' => 'OPPA-PRM-WEEKEND',
                'code' => 'WEEKEND15',
                'title' => '🍗 Weekend Chicken Special',
                'description' => '15% discount on all crispy authentic Korean chicken.',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'applicable_categories' => ['chicken'],
                'min_order_amount' => 0,
                'is_active' => true,
                'start_date' => now()->subDay(),
                'end_date' => now()->addYear(),
            ],
            [
                'id' => 'OPPA-PRM-DEAL99',
                'code' => 'DEAL99',
                'title' => '🍚 ₱99 Sulit Deal',
                'description' => 'Save ₱20 on your favorite Rice Meals.',
                'discount_type' => 'fixed',
                'discount_value' => 20,
                'applicable_categories' => ['rice-meals'],
                'min_order_amount' => 99,
                'is_active' => true,
                'start_date' => now()->subDay(),
                'end_date' => now()->addYear(),
            ],
            [
                'id' => 'OPPA-PRM-FAMILY',
                'code' => 'FAMILY49',
                'title' => '👨‍👩‍👧 Family Bundle Promo',
                'description' => 'Family Bucket + 1.5L Soda special ₱49 savings.',
                'discount_type' => 'fixed',
                'discount_value' => 49,
                'min_order_amount' => 450,
                'is_active' => true,
                'start_date' => now()->subDay(),
                'end_date' => now()->addYear(),
            ],
        ];

        foreach ($promos as $promoData) {
            Promo::updateOrCreate(['code' => $promoData['code']], $promoData);
        }
    }
}


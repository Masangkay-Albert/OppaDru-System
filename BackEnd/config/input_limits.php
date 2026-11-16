<?php

return [
    'ingredient_name' => [
        'min' => 2,
        'max' => 50,
        'pattern' => "~^[\\p{L}\\p{N} '&.,()/\\-]+$~u",
    ],
    'person_name' => [
        'min' => 2,
        'max' => 60,
        'pattern' => "~^[\\p{L} .'-]+$~u",
    ],
    'phone' => '/^(?:09\d{9}|\+639\d{9})$/',
    'first_or_last_name' => [
        'min' => 1,
        'max' => 30,
    ],
    'business_name' => [
        'min' => 2,
        'max' => 80,
        'pattern' => "~^[\\p{L}\\p{N} '&.,()\\-]+$~u",
    ],
    'product_name' => [
        'min' => 2,
        'max' => 50,
        'pattern' => "~^[\\p{L}\\p{N} '&.,()\\-]+$~u",
    ],
    'category_or_supplier_name' => [
        'min' => 2,
        'max' => 50,
    ],
    'short_description' => 120,
    'long_text' => 255,
    'replacement_description' => [
        'min' => 3,
        'max' => 255,
    ],
    'reason' => [
        'min' => 3,
        'max' => 200,
    ],
    'announcement_title' => [
        'min' => 3,
        'max' => 80,
    ],
    'announcement_body' => 1000,
    'application_text' => 5000,
    'search' => 100,
    'email' => 254,
    'registration_email' => 50,
    'password' => [
        'min' => 8,
        'max' => 64,
    ],
    'username' => [
        'min' => 4,
        'max' => 30,
    ],
    'promo_code' => [
        'min' => 4,
        'max' => 20,
        'pattern' => '/^[A-Z0-9-]+$/',
    ],
    'reference' => [
        'max' => 30,
        'pattern' => '/^[a-zA-Z0-9-]+$/',
    ],
    'amount' => 999999.99,
    'investment_capacity' => '9999999999.99',
    'inventory_quantity' => 999999.999,
    'percentage' => 100,
    'inventory_conversion' => 999999,
    'total_price_paid' => 9999999.99,
];

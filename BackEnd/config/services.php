<?php

return [

    'paymongo' => [
        'secret_key' => env('PAYMONGO_SECRET_KEY'),
        'webhook_secret' => env('PAYMONGO_WEBHOOK_SECRET'),
        'base_url' => env('PAYMONGO_BASE_URL', 'https://api.paymongo.com/v1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gmail' => [
        'client_id' => env('GMAIL_CLIENT_ID'),
        'client_secret' => env('GMAIL_CLIENT_SECRET'),
        'refresh_token' => env('GMAIL_REFRESH_TOKEN'),
    ],

    'facebook' => [
        'page_id' => env('FACEBOOK_PAGE_ID'),
        'page_access_token' => env('FACEBOOK_PAGE_ACCESS_TOKEN'),
        'api_version' => env('FACEBOOK_API_VERSION', 'v26.0'),
    ],

    'nominatim' => [
        'user_agent' => env('NOMINATIM_USER_AGENT', 'OppaDruFoodDelivery/1.0'),
        'referer' => env('NOMINATIM_REFERER', env('APP_URL', 'http://localhost')),
    ],
    'delivery' => [
        'max_km' => env('MAX_DELIVERY_KM', 15),
    ],

];
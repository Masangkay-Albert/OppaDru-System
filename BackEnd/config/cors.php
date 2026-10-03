<?php

return [
    'paths' => ['*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'https://oppa-dru-system.vercel.app',
        'https://oppa-drusystem.vercel.app',
        'https://oppa-dru-system-1.onrender.com',
    ],
    'allowed_origins_patterns' => [
        '#^https://oppa[-]?dru[-]?system(?:-[a-z0-9-]+)?\.vercel\.app$#i',
        '#^https://oppa[-]?dru[-]?system.*\.vercel\.app$#i',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
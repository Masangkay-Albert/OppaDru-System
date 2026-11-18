<?php

return [
    'timezone' => 'Asia/Manila',
    'opening' => '11:00',
    'last_order' => '22:30',
    'closing' => '23:00',
    'allow_client_clock' => (bool) env('STORE_HOURS_ALLOW_CLIENT_CLOCK', true),
];

<?php

namespace App\Http\Controllers;

use App\Support\StoreHours;

class StoreHoursController extends Controller
{
    public function show()
    {
        return response()
            ->json(StoreHours::status())
            ->header('Cache-Control', 'no-store');
    }
}

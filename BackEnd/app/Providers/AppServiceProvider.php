<?php

namespace App\Providers;

use App\Mail\GmailApiTransport;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Mail::extend('gmail_api', function () {
            return new GmailApiTransport(
                config('services.gmail.client_id'),
                config('services.gmail.client_secret'),
                config('services.gmail.refresh_token'),
            );
        });
    }
}
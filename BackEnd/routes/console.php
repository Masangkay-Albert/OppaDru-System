<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('mail:test {recipient}', function (string $recipient) {
    $this->info('Mailer: '.config('mail.default'));
    $this->info('Host: '.config('mail.mailers.smtp.host'));
    $this->info('Port: '.config('mail.mailers.smtp.port'));
    $this->info('Username: '.config('mail.mailers.smtp.username'));
    $this->info('From: '.config('mail.from.address'));

    try {
        Mail::raw('This is a real production mail delivery test from Oppa Dru.', function ($message) use ($recipient) {
            $message->to($recipient)->subject('Oppa Dru mail delivery test');
        });
    } catch (\Throwable $exception) {
        Log::error('Production mail test failed.', [
            'recipient' => $recipient,
            'exception' => $exception,
        ]);
        $this->error('Mail delivery failed. Check the Render logs for the exception details.');
        return 1;
    }

    $this->info('Mail was accepted by the configured transport. Check the recipient inbox.');
    return 0;
})->purpose('Send a real email through the configured production mailer');

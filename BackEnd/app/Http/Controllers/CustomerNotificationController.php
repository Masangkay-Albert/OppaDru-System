<?php

namespace App\Http\Controllers;

use App\Notifications\ReplacementStatusNotification;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class CustomerNotificationController extends Controller
{
    public function replacementUpdates(Request $request)
    {
        $notifications = $request->user()
            ->notifications()
            ->where('type', ReplacementStatusNotification::class)
            ->latest()
            ->limit(50)
            ->get()
            ->map(static function (DatabaseNotification $notification): array {
                $payload = $notification->data;

                return [
                    'id' => (string) $notification->id,
                    'title' => (string) ($payload['title'] ?? 'Replacement request update'),
                    'content' => (string) ($payload['message'] ?? 'Your replacement request has been updated.'),
                    'date' => $notification->created_at?->toIso8601String(),
                    'read_at' => $notification->read_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['data' => $notifications]);
    }
}

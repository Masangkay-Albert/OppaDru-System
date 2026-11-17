<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class StoreHours
{
    public static function status(?CarbonImmutable $now = null): array
    {
        $timezone = (string) config('store_hours.timezone');
        $openingTime = (string) config('store_hours.opening');
        $lastOrderTime = (string) config('store_hours.last_order');
        $closingTime = (string) config('store_hours.closing');
        $localNow = ($now ?? CarbonImmutable::now($timezone))->setTimezone($timezone);

        [$openingHour, $openingMinute] = array_map('intval', explode(':', $openingTime));
        [$lastOrderHour, $lastOrderMinute] = array_map('intval', explode(':', $lastOrderTime));
        [$closingHour, $closingMinute] = array_map('intval', explode(':', $closingTime));

        $openingToday = $localNow->startOfDay()->setTime($openingHour, $openingMinute);
        $lastOrderToday = $localNow->startOfDay()->setTime($lastOrderHour, $lastOrderMinute);
        $closingToday = $localNow->startOfDay()->setTime($closingHour, $closingMinute);

        if ($localNow->lt($openingToday) || $localNow->gte($closingToday)) {
            $state = 'closed';
        } elseif ($localNow->gte($lastOrderToday)) {
            $state = 'last_order_passed';
        } else {
            $state = 'open';
        }

        $opensToday = $localNow->lt($openingToday);
        $nextOpening = $opensToday ? $openingToday : $openingToday->addDay();
        $openingLabel = $openingToday->format('g:i A');
        $lastOrderLabel = $lastOrderToday->format('g:i A');
        $closingLabel = $closingToday->format('g:i A');

        return [
            'state' => $state,
            'next_opening_at' => $nextOpening->toIso8601String(),
            'next_opening_label' => sprintf('Opens %s at %s', $opensToday ? 'today' : 'tomorrow', $openingLabel),
            'configured_hours' => [
                'opening' => $openingLabel,
                'last_order' => $lastOrderLabel,
                'closing' => $closingLabel,
                'timezone' => $timezone,
            ],
            'order_closed_message' => "Sorry, we're no longer accepting orders. Last order is at {$lastOrderLabel}.",
        ];
    }
}

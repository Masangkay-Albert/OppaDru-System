<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class StoreHours
{
    public static function getCurrentStoreTime(?string $clientTime = null): CarbonImmutable
    {
        $timezone = (string) config('store_hours.timezone');
        if (config('store_hours.allow_client_clock') && $clientTime !== null) {
            return CarbonImmutable::parse($clientTime)->setTimezone($timezone);
        }

        return CarbonImmutable::now('UTC')->setTimezone($timezone);
    }

    public static function status(?string $clientTime = null): array
    {
        $timezone = (string) config('store_hours.timezone');
        $openingTime = (string) config('store_hours.opening');
        $lastOrderTime = (string) config('store_hours.last_order');
        $closingTime = (string) config('store_hours.closing');
        $currentTime = self::getCurrentStoreTime($clientTime);

        [$openingHour, $openingMinute] = array_map('intval', explode(':', $openingTime));
        [$lastOrderHour, $lastOrderMinute] = array_map('intval', explode(':', $lastOrderTime));
        [$closingHour, $closingMinute] = array_map('intval', explode(':', $closingTime));

        $openingToday = $currentTime->startOfDay()->setTime($openingHour, $openingMinute);
        $lastOrderToday = $currentTime->startOfDay()->setTime($lastOrderHour, $lastOrderMinute);
        $closingToday = $currentTime->startOfDay()->setTime($closingHour, $closingMinute);

        if ($currentTime->lt($openingToday) || $currentTime->gte($closingToday)) {
            $state = 'closed';
        } elseif ($currentTime->gte($lastOrderToday)) {
            $state = 'last_order_passed';
        } else {
            $state = 'open';
        }

        $opensToday = $currentTime->lt($openingToday);
        $nextOpening = $opensToday ? $openingToday : $openingToday->addDay();
        $openingLabel = $openingToday->format('g:i A');
        $lastOrderLabel = $lastOrderToday->format('g:i A');
        $closingLabel = $closingToday->format('g:i A');

        return [
            'state' => $state,
            'current_store_time' => $currentTime->toIso8601String(),
            'next_opening_at' => $nextOpening->toIso8601String(),
            'next_opening_label' => sprintf('Opens %s at %s', $opensToday ? 'today' : 'tomorrow', $openingLabel),
            'configured_hours' => [
                'opening' => $openingLabel,
                'last_order' => $lastOrderLabel,
                'closing' => $closingLabel,
                'timezone' => $timezone,
            ],
            'order_closed_message' => "Sorry, we're not accepting orders right now. Ordering is open from {$openingLabel} to {$lastOrderLabel}.",
        ];
    }
}

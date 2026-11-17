<?php

namespace App\Support;

use App\Models\SystemSetting;
use Carbon\CarbonImmutable;
use RuntimeException;

final class StoreHours
{
    private const SIMULATION_SETTING_KEY = 'store_hours_simulation';

    public static function getCurrentStoreTime(bool $useSimulation = true): CarbonImmutable
    {
        $timezone = (string) config('store_hours.timezone');
        $realNow = CarbonImmutable::now('UTC');
        if (! $useSimulation) {
            return $realNow->setTimezone($timezone);
        }

        $simulation = self::simulationSettings();
        if (! $simulation['enabled']) {
            return $realNow->setTimezone($timezone);
        }
        if (! $simulation['simulated_at'] || ! $simulation['real_anchor_at']) {
            throw new RuntimeException('Store-hours simulation is missing its time anchors.');
        }

        $simulatedAt = CarbonImmutable::parse($simulation['simulated_at'], $timezone)->setTimezone($timezone);
        $realAnchor = CarbonImmutable::parse($simulation['real_anchor_at'], 'UTC')->setTimezone('UTC');
        $elapsedSeconds = $realNow->getTimestamp() - $realAnchor->getTimestamp();

        return $simulatedAt->addSeconds($elapsedSeconds);
    }

    public static function simulationSettings(): array
    {
        $value = SystemSetting::query()
            ->where('key', self::SIMULATION_SETTING_KEY)
            ->whereNull('franchise_id')
            ->value('value');

        if ($value === null) {
            return ['enabled' => false, 'simulated_at' => null, 'real_anchor_at' => null];
        }

        $simulation = json_decode((string) $value, true);
        if (! is_array($simulation) || ! array_key_exists('enabled', $simulation)) {
            throw new RuntimeException('Store-hours simulation settings are invalid.');
        }

        $enabled = $simulation['enabled'] === true;
        $simulatedAt = $simulation['simulated_at'] ?? null;
        $realAnchorAt = $simulation['real_anchor_at'] ?? null;
        if ($enabled && (! is_string($simulatedAt) || ! is_string($realAnchorAt))) {
            throw new RuntimeException('Store-hours simulation is missing its time anchors.');
        }

        return [
            'enabled' => $enabled,
            'simulated_at' => is_string($simulatedAt) ? $simulatedAt : null,
            'real_anchor_at' => is_string($realAnchorAt) ? $realAnchorAt : null,
        ];
    }

    public static function status(): array
    {
        $timezone = (string) config('store_hours.timezone');
        $openingTime = (string) config('store_hours.opening');
        $lastOrderTime = (string) config('store_hours.last_order');
        $closingTime = (string) config('store_hours.closing');
        $currentTime = self::getCurrentStoreTime();

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
        $simulation = self::simulationSettings();

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
            'simulation_enabled' => $simulation['enabled'],
        ];
    }
}

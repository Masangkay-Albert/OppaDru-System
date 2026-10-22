<?php

namespace App\Services\Order;

use App\Models\Franchise;
use App\Models\Order;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class ScheduleService
{
    public function isScheduled(Order $order): bool
    {
        return (bool) $order->is_scheduled || (
            $order->delivery_type === 'scheduled'
            && ($order->scheduled_for || $order->scheduled_at)
        );
    }

    public function scheduledFor(Order $order): ?Carbon
    {
        $date = $order->scheduled_date;
        $time = $order->schedule_window ?: $order->scheduled_time;
        if ($date && $time) {
            if (preg_match('/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i', (string) $time, $matches)) {
                $time = $matches[0];
            }

            try {
                return Carbon::parse($date.' '.$time, 'Asia/Manila');
            } catch (\Throwable) {
                // Fall back to the timestamp when legacy schedule fields are malformed.
            }
        }

        $value = $order->scheduled_for ?? $order->scheduled_at;

        return $value ? Carbon::parse($value, 'UTC')->timezone('Asia/Manila') : null;
    }

    public function prepStartTime(CarbonInterface $scheduledFor): Carbon
    {
        return Carbon::instance($scheduledFor)
            ->timezone('Asia/Manila')
            ->subMinutes((int) config('kitchen.prep_lead_time_minutes', 30));
    }

    public function operatingHoursError(?Franchise $franchise, CarbonInterface $scheduledFor): ?string
    {
        $hours = trim((string) data_get($franchise?->metadata, 'operating_hours', ''));
        if ($hours === '') {
            return null;
        }

        preg_match('/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i', $hours, $matches);
        if (count($matches) !== 3) {
            return null;
        }

        try {
            $date = Carbon::instance($scheduledFor)->timezone('Asia/Manila')->format('Y-m-d');
            $opens = Carbon::parse($date.' '.$matches[1], 'Asia/Manila');
            $closes = Carbon::parse($date.' '.$matches[2], 'Asia/Manila');
        } catch (\Throwable) {
            return null;
        }

        $target = Carbon::instance($scheduledFor)->timezone('Asia/Manila');
        if ($closes->lessThanOrEqualTo($opens)) {
            $closes->addDay();
            if ($target->lessThan($opens)) {
                $opens->subDay();
                $closes->subDay();
            }
        }

        return $target->betweenIncluded($opens, $closes)
            ? null
            : 'Scheduled time must be within the branch operating hours ('.$matches[1].' to '.$matches[2].').';
    }
}

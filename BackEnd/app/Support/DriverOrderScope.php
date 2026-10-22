<?php

namespace App\Support;

use App\Models\Driver;
use App\Models\Franchise;
use Illuminate\Database\Eloquent\Builder;

final class DriverOrderScope
{
    public static function branchId(Driver $driver): ?string
    {
        if ($driver->franchise_id !== null) {
            return (string) $driver->franchise_id;
        }

        $mainBranchId = Franchise::query()->where('is_main', true)->value('id');

        return $mainBranchId !== null ? (string) $mainBranchId : null;
    }

    public static function applyBranch(Builder $query, ?string $branchId): Builder
    {
        return $query->where(function (Builder $branchQuery) use ($branchId): void {
            if ($branchId === null) {
                $branchQuery->whereNull('branch_id')->whereNull('franchise_id');

                return;
            }

            $branchQuery->where('branch_id', $branchId)
                ->orWhere(function (Builder $legacyQuery) use ($branchId): void {
                    $legacyQuery->whereNull('branch_id')
                        ->where('franchise_id', $branchId);
                });
        });
    }

    public static function applyDeliveryEligibility(Builder $query): Builder
    {
        return $query
            ->where(function (Builder $deliveryTypeQuery): void {
                $deliveryTypeQuery->whereNull('delivery_type')
                    ->orWhereRaw('LOWER(delivery_type) NOT IN (?, ?)', ['onsite', 'pickup']);
            })
            ->where(function (Builder $fulfillmentQuery): void {
                $fulfillmentQuery
                    ->whereRaw('LOWER(COALESCE(fulfillment_type, ?)) = ?', ['', 'delivery'])
                    ->orWhere(function (Builder $legacyQuery): void {
                        $legacyQuery->whereNull('fulfillment_type')
                            ->whereNotNull('delivery_type')
                            ->whereRaw('LOWER(delivery_type) NOT IN (?, ?)', ['onsite', 'pickup']);
                    });
            });
    }
}

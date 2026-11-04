<?php

namespace App\Services;

use App\Models\Franchise;

class DeliveryOutOfRangeException extends \InvalidArgumentException
{
    public function __construct(
        public readonly Franchise $nearestBranch,
        public readonly float $distanceKm,
    ) {
        parent::__construct('Address is outside our delivery area.');
    }

    public function responsePayload(): array
    {
        $distanceText = $this->distanceKm > 100
            ? 'over 100 km'
            : number_format($this->distanceKm, 1).' km';

        return [
            'code' => 'OUT_OF_RANGE',
            'title' => 'Address is outside our delivery area',
            'message' => 'We only deliver within '.number_format(BranchRoutingService::MAX_DELIVERY_RADIUS_KM, 0).' km of a branch. The nearest branch is '.$this->nearestBranch->name.', '.$distanceText.' away.',
            'nearest_branch' => [
                'id' => $this->nearestBranch->id,
                'name' => $this->nearestBranch->name,
            ],
            'distance_km' => $this->distanceKm,
        ];
    }
}

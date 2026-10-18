<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Order\OrderManagementActions;
use App\Http\Controllers\Order\OrderOnsiteActions;
use App\Http\Controllers\Order\OrderPlacementActions;
use App\Http\Controllers\Order\OrderQueryActions;
use App\Services\FranchiseInventoryService;
use App\Services\BranchRoutingService;
use App\Services\Order\OrderDataService;
use App\Services\Order\ScheduleService;

class OrderController extends Controller
{
    use OrderManagementActions;
    use OrderOnsiteActions;
    use OrderPlacementActions;
    use OrderQueryActions;

    public function __construct(
        private readonly OrderDataService $orderDataService,
        private readonly FranchiseInventoryService $franchiseInventoryService,
        private readonly BranchRoutingService $branchRoutingService,
        private readonly ScheduleService $scheduleService,
    ) {}

}

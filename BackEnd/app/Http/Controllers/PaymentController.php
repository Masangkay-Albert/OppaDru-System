<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Payment\PaymentCheckoutActions;
use App\Http\Controllers\Payment\PaymentStatusActions;
use App\Http\Controllers\Payment\PaymentWebhookActions;
use App\Services\Payment\PaymentHelperService;
use App\Services\PricingService;
use App\Services\BranchRoutingService;

class PaymentController extends Controller
{
    use PaymentCheckoutActions;
    use PaymentStatusActions;
    use PaymentWebhookActions;

    public function __construct(
        private readonly PaymentHelperService $paymentHelper,
        private readonly PricingService $pricingService,
        private readonly BranchRoutingService $branchRoutingService,
    ) {}

}

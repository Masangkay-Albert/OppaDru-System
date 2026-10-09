<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Payment\PaymentCheckoutActions;
use App\Http\Controllers\Payment\PaymentStatusActions;
use App\Http\Controllers\Payment\PaymentWebhookActions;
use App\Services\Payment\PaymentHelperService;
use App\Services\PricingService;

class PaymentController extends Controller
{
    use PaymentCheckoutActions;
    use PaymentStatusActions;
    use PaymentWebhookActions;

    public function __construct(
        private readonly PaymentHelperService $paymentHelper,
        private readonly PricingService $pricingService,
    ) {}

}

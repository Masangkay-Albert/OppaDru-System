<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Franchise\FranchiseAdminActions;
use App\Http\Controllers\Franchise\FranchiseBranchOperations;
use App\Http\Controllers\Franchise\FranchiseDashboardActions;
use App\Http\Controllers\Franchise\FranchisePosOrderActions;
use App\Http\Controllers\Franchise\FranchisePosPaymentActions;
use App\Http\Controllers\Franchise\FranchisePosReadActions;
use App\Http\Controllers\Franchise\FranchiseSummaryActions;
use App\Traits\AdminAuthTrait;

class FranchiseController extends Controller
{
    use AdminAuthTrait;
    use FranchiseAdminActions;
    use FranchiseBranchOperations;
    use FranchiseDashboardActions;
    use FranchisePosOrderActions;
    use FranchisePosPaymentActions;
    use FranchisePosReadActions;
    use FranchiseSummaryActions;
}

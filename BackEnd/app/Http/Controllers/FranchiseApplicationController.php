<?php

namespace App\Http\Controllers;

use App\Http\Controllers\FranchiseApplication\FranchiseApplicationActivationActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationAdminReviewActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationApplicantActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationOpportunityActions;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Traits\AdminAuthTrait;

class FranchiseApplicationController extends Controller
{
    use AdminAuthTrait;
    use FranchiseApplicationActivationActions;
    use FranchiseApplicationAdminReviewActions;
    use FranchiseApplicationApplicantActions;
    use FranchiseApplicationOpportunityActions;

    private function recordEvent(
        FranchiseApplication $application,
        string $actorType,
        string|int|null $actorId,
        ?string $status,
        string $title,
        ?string $message,
        bool $internal = false,
    ): void {
        FranchiseApplicationEvent::create([
            'application_id' => $application->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId === null ? null : (string) $actorId,
            'status' => $status,
            'title' => $title,
            'message' => $message,
            'is_internal' => $internal,
            'created_at' => now(),
        ]);
    }
}

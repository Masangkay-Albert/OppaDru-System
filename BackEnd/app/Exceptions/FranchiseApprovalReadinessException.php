<?php

namespace App\Exceptions;

use RuntimeException;

class FranchiseApprovalReadinessException extends RuntimeException
{
    public function __construct(public readonly array $issues)
    {
        parent::__construct('Approval requires all readiness checks to pass or a documented override reason.');
    }
}

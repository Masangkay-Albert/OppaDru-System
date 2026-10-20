<?php

namespace App\Exceptions;

use RuntimeException;

class FranchiseApprovalException extends RuntimeException
{
    public function __construct(string $message, public readonly ?string $errorCode = null)
    {
        parent::__construct($message);
    }
}

<?php

namespace App\Services;

use RuntimeException;

class PromoRedemptionException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly ?float $amountRemaining = null,
    ) {
        parent::__construct($message);
    }
}

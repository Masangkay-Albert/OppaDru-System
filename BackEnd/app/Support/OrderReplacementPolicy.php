<?php

namespace App\Support;

final class OrderReplacementPolicy
{
    public const CUSTOMER_REPORT_WINDOW_HOURS = 6;

    public const ISSUE_TYPES = [
        'hair_or_foreign_object',
        'wrong_item',
        'missing_item',
        'spilled_or_damaged',
        'not_fresh',
        'other',
    ];

    public const OPEN_STATUSES = ['pending', 'approved', 'replacement_sent'];
}

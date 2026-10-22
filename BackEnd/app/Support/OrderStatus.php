<?php

namespace App\Support;

final class OrderStatus
{
    public const PENDING = 'pending';

    public const PREPARING = 'preparing';

    public const PREPARED = 'prepared';

    public const READY = 'ready';

    public const ON_THE_WAY = 'on_the_way';

    public const ARRIVED = 'arrived';

    public const DELIVERED = 'delivered';

    public const COMPLETED = 'completed';

    public const CANCELLED = 'cancelled';

    public const KITCHEN_ALLOWED = [
        self::PENDING,
        self::PREPARING,
        self::PREPARED,
        self::READY,
        self::COMPLETED,
        self::CANCELLED,
    ];

    public const DRIVER_ALLOWED_TRANSITIONS = [
        self::ON_THE_WAY,
        self::ARRIVED,
        self::DELIVERED,
    ];
}

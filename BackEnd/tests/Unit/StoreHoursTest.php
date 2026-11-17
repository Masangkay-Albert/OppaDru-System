<?php

namespace Tests\Unit;

use App\Support\StoreHours;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class StoreHoursTest extends TestCase
{
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_store_closes_when_backend_clock_reaches_closing_time(): void
    {
        CarbonImmutable::setTestNow(
            CarbonImmutable::parse('2026-11-17 23:00:00', 'Asia/Manila')
        );

        $status = StoreHours::status();

        $this->assertSame('closed', $status['state']);
        $this->assertStringContainsString('2026-11-17T23:00:00', $status['current_store_time']);
        $this->assertArrayNotHasKey('simulation_enabled', $status);
    }
}

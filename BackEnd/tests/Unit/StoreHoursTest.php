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

    public function test_demo_store_hours_can_use_client_clock_when_enabled(): void
    {
        config(['store_hours.allow_client_clock' => true]);
        CarbonImmutable::setTestNow(
            CarbonImmutable::parse('2026-11-18 01:00:00', 'UTC')
        );

        $status = StoreHours::status('2026-11-18T03:47:00.000Z');

        $this->assertSame('open', $status['state']);
        $this->assertStringContainsString('2026-11-18T11:47:00', $status['current_store_time']);
    }

    public function test_production_store_hours_ignore_client_clock(): void
    {
        config(['store_hours.allow_client_clock' => false]);
        CarbonImmutable::setTestNow(
            CarbonImmutable::parse('2026-11-18 01:00:00', 'UTC')
        );

        $status = StoreHours::status('2026-11-18T03:47:00.000Z');

        $this->assertSame('closed', $status['state']);
        $this->assertStringContainsString('2026-11-18T09:00:00', $status['current_store_time']);
    }
}

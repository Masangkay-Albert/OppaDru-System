<?php

namespace App\Console\Commands;

use App\Models\Franchise;
use App\Models\FranchiseApplication;
use App\Services\FranchiseApplicationApprovalService;
use App\Services\GeocodingService;
use Illuminate\Console\Command;
use Throwable;

class BackfillFranchiseCoordinates extends Command
{
    protected $signature = 'franchises:backfill-location
        {--dry-run : Geocode locations without saving changes}
        {--enable-delivery : Ask to enable delivery for active branches that already have coordinates}';

    protected $description = 'Geocode franchise locations and retry approved applications awaiting location setup';

    public function handle(GeocodingService $geocoding, FranchiseApplicationApprovalService $approval): int
    {
        $franchises = Franchise::query()
            ->where(fn ($query) => $query->whereNull('latitude')->orWhereNull('longitude'))
            ->orderBy('id')
            ->get();

        $failed = 0;
        $rows = [];
        foreach ($franchises as $franchise) {
            $coordinates = $geocoding->geocodeAddress((string) $franchise->address);
            if (! $coordinates) {
                $rows[] = [$franchise->id, $franchise->name, 'FAILED', 'Address could not be geocoded'];
                if (! $this->option('dry-run')) {
                    $franchise->forceFill([
                        'location_status' => 'needs_location',
                        'location_error' => 'The branch address could not be geocoded during backfill.',
                    ])->saveOrFail();
                }
                $failed++;
                continue;
            }

            try {
                if (! $this->option('dry-run')) {
                    $franchise->latitude = $coordinates['lat'];
                    $franchise->longitude = $coordinates['lng'];
                    $franchise->location_status = 'geocoded';
                    $franchise->location_error = null;
                    $franchise->saveOrFail();
                    $franchise->refresh();
                    if ($franchise->latitude === null || $franchise->longitude === null) {
                        throw new \RuntimeException('Coordinates did not persist after saving.');
                    }
                }
            } catch (Throwable $exception) {
                $rows[] = [$franchise->id, $franchise->name, 'FAILED', $exception->getMessage()];
                $failed++;
                continue;
            }

            $action = $this->option('dry-run') ? 'WOULD UPDATE' : 'UPDATED';
            $rows[] = [
                $franchise->id,
                $franchise->name,
                $action,
                sprintf('%.7f, %.7f', $coordinates['lat'], $coordinates['lng']),
            ];
        }

        if ($rows !== []) {
            $this->table(['Franchise ID', 'Name', 'Result', 'Coordinates / Details'], $rows);
        } else {
            $this->info('No franchise rows are missing coordinates.');
        }

        $pendingApplications = FranchiseApplication::query()
            ->where('status', 'approved')
            ->whereNull('franchise_id')
            ->orderBy('id')
            ->get();
        $applicationRows = [];
        foreach ($pendingApplications as $application) {
            if ($this->option('dry-run')) {
                $applicationRows[] = [$application->id, $application->franchise_name, 'PENDING', 'Would retry provisioning'];
                continue;
            }

            try {
                $provisioned = $approval->approve((string) $application->id, null);
                if ($provisioned->franchise_id) {
                    $applicationRows[] = [$application->id, $application->franchise_name, 'PROVISIONED', $provisioned->franchise_id];
                } else {
                    $applicationRows[] = [$application->id, $application->franchise_name, 'PENDING', 'Address could not be geocoded'];
                    $failed++;
                }
            } catch (Throwable $exception) {
                $applicationRows[] = [$application->id, $application->franchise_name, 'FAILED', $exception->getMessage()];
                $failed++;
            }
        }
        if ($applicationRows !== []) {
            $this->table(['Application ID', 'Franchise', 'Result', 'Details'], $applicationRows);
        }

        $disabledBranches = Franchise::query()
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->where(fn ($query) => $query
                ->where(fn ($orders) => $orders->where('accepts_online_orders', false)->orWhereNull('accepts_online_orders'))
                ->orWhere(fn ($delivery) => $delivery->where('delivery_enabled', false)->orWhereNull('delivery_enabled')))
            ->get();

        if ($disabledBranches->isNotEmpty()) {
            $enableDelivery = $this->option('enable-delivery')
                && ! $this->option('dry-run')
                && $this->confirm('Enable online orders and delivery for all listed active branches with coordinates?');
            if ($enableDelivery) {
                foreach ($disabledBranches as $branch) {
                    $branch->forceFill([
                        'accepts_online_orders' => true,
                        'delivery_enabled' => true,
                    ])->saveOrFail();
                }
                $this->info('Delivery enabled for '.$disabledBranches->count().' active branch(es).');
            } else {
                $this->warn('Active branches with coordinates but ordering or delivery disabled (not changed):');
                $this->table(
                    ['Franchise ID', 'Name', 'Online orders', 'Delivery'],
                    $disabledBranches->map(fn (Franchise $branch) => [
                        $branch->id,
                        $branch->name,
                        $branch->accepts_online_orders ? 'On' : 'Off',
                        $branch->delivery_enabled ? 'On' : 'Off',
                    ])->all(),
                );
            }
        }

        $this->line(sprintf(
            'Processed %d franchise location(s) and %d pending application(s); %d failed.',
            $franchises->count(),
            $pendingApplications->count(),
            $failed,
        ));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}

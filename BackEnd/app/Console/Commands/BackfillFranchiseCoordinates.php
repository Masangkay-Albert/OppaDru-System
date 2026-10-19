<?php

namespace App\Console\Commands;

use App\Models\Franchise;
use App\Services\GeocodingService;
use Illuminate\Console\Command;
use Throwable;

class BackfillFranchiseCoordinates extends Command
{
    protected $signature = 'franchises:backfill-coordinates {--dry-run : Geocode locations without saving coordinates}';

    protected $description = 'Geocode franchise locations that do not yet have coordinates';

    public function handle(GeocodingService $geocoding): int
    {
        $franchises = Franchise::query()
            ->where(fn ($query) => $query->whereNull('latitude')->orWhereNull('longitude'))
            ->orderBy('id')
            ->get();

        if ($franchises->isEmpty()) {
            $this->info('All franchise locations already have coordinates.');

            return self::SUCCESS;
        }

        $failed = 0;
        foreach ($franchises as $franchise) {
            $coordinates = $geocoding->geocodeAddress((string) $franchise->address);
            if (! $coordinates) {
                $this->error("FAILED {$franchise->id} ({$franchise->name}): address could not be geocoded.");
                $failed++;
                continue;
            }

            try {
                if (! $this->option('dry-run')) {
                    $franchise->latitude = $coordinates['lat'];
                    $franchise->longitude = $coordinates['lng'];
                    $franchise->saveOrFail();
                    $franchise->refresh();
                    if ($franchise->latitude === null || $franchise->longitude === null) {
                        throw new \RuntimeException('Coordinates did not persist after saving.');
                    }
                }
            } catch (Throwable $exception) {
                $this->error("FAILED {$franchise->id} ({$franchise->name}): {$exception->getMessage()}");
                $failed++;
                continue;
            }

            $action = $this->option('dry-run') ? 'WOULD UPDATE' : 'UPDATED';
            $this->info(sprintf(
                '%s %s (%s): %.7f, %.7f',
                $action,
                $franchise->id,
                $franchise->name,
                $coordinates['lat'],
                $coordinates['lng'],
            ));
        }

        $this->line(sprintf('Processed %d franchise location(s); %d failed.', $franchises->count(), $failed));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}

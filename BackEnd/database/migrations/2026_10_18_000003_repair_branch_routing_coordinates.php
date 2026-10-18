<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('franchises')) return;

        // Coordinates are deployment data. Apply only an explicit mapping
        // supplied by the deployment environment, never a branch name, ID, or
        // city-specific fallback embedded in application code.
        $mapping = json_decode((string) env('BRANCH_ROUTING_COORDINATES', '{}'), true);
        if (! is_array($mapping)) return;

        foreach ($mapping as $branchId => $coordinates) {
            if (! is_array($coordinates) || ! isset($coordinates['lat'], $coordinates['lng'])) continue;
            DB::table('franchises')->where('id', $branchId)->update([
                'latitude' => $coordinates['lat'],
                'longitude' => $coordinates['lng'],
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Routing coordinates are deployment data and must not be erased on rollback.
    }
};

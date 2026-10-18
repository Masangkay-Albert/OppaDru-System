<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('franchises')) return;

        $settings = DB::table('system_settings')->whereIn('key', ['merchant_latitude', 'merchant_longitude'])
            ->pluck('value', 'key');
        $mainLatitude = env('MAIN_BRANCH_LATITUDE') ?: ($settings['merchant_latitude'] ?? null);
        $mainLongitude = env('MAIN_BRANCH_LONGITUDE') ?: ($settings['merchant_longitude'] ?? null);
        $lagunaLatitude = env('LAGUNA_BRANCH_LATITUDE', 14.318056);
        $lagunaLongitude = env('LAGUNA_BRANCH_LONGITUDE', 121.101111);

        if ($mainLatitude !== null && $mainLongitude !== null) {
            $caviteBranch = DB::table('franchises')
                ->where('name', 'like', '%Cavite%')
                ->orderBy('id')
                ->first();

            if ($caviteBranch) {
                DB::table('franchises')
                ->where('id', $caviteBranch->id)
                ->update([
                    'latitude' => $mainLatitude,
                    'longitude' => $mainLongitude,
                    'is_main' => true,
                    'is_active' => true,
                    'accepts_online_orders' => true,
                    'delivery_enabled' => true,
                    'updated_at' => now(),
                ]);

                DB::table('franchises')
                    ->where('is_main', true)
                    ->where('id', '<>', $caviteBranch->id)
                    ->update([
                        'is_main' => false,
                        'is_active' => false,
                        'accepts_online_orders' => false,
                        'delivery_enabled' => false,
                        'updated_at' => now(),
                    ]);
            }
        }

        DB::table('franchises')
            ->where(function ($query) {
                $query->where('name', 'like', '%Laguna%')
                    ->orWhere('id', 'OPPA-FR-P4G0PFQ2');
            })
            ->update([
                'latitude' => $lagunaLatitude,
                'longitude' => $lagunaLongitude,
                'is_active' => true,
                'accepts_online_orders' => true,
                'delivery_enabled' => true,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Routing coordinates are deployment data and must not be erased on rollback.
    }
};

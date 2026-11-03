<?php

namespace Database\Seeders;

use App\Models\Franchise;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class MainBranchSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $branches = Franchise::query()
                ->where(function ($query): void {
                    $query->where('slug', 'cavite-branch')
                        ->orWhereRaw('LOWER(name) = ?', ['cavite branch']);
                })
                ->lockForUpdate()
                ->get();

            if ($branches->count() > 1) {
                throw new RuntimeException('Cannot configure the main branch: multiple Cavite branch records were found.');
            }

            $branch = $branches->first() ?? new Franchise();
            $branch->fill([
                'name' => 'Cavite Branch',
                'slug' => 'cavite-branch',
                'address' => '37 Malihan St. Barangay Zone 1, Dasmariñas, Cavite, Philippines',
                'status' => 'active',
                'is_active' => true,
                'latitude' => 14.3286124,
                'longitude' => 120.9355294,
                'accepts_online_orders' => true,
                'delivery_enabled' => true,
                'delivery_radius_km' => 10,
                'is_main' => false,
            ]);
            $branch->save();

            Franchise::query()
                ->where('is_main', true)
                ->where('id', '!=', $branch->id)
                ->update(['is_main' => false]);

            $branch->is_main = true;
            $branch->save();
        });
    }
}

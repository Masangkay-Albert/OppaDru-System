<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $groupId = DB::table('addon_groups')->where('name', 'Noodle Add-ons')->value('id');
        if (!$groupId) return;

        foreach ([['Egg', 25], ['Extra Meat', 55], ['Extra Veggies', 25]] as [$name, $price]) {
            DB::table('addons')->insertOrIgnore([
                'addon_group_id' => $groupId,
                'name' => $name,
                'price' => $price,
                'is_active' => true,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Keep configuration rows on rollback so administrator changes are preserved.
    }
};
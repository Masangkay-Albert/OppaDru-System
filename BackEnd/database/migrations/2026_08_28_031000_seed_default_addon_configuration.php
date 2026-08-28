<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $groups = [
            ['name' => 'Meal Add-ons', 'categories' => ['rice-meals', 'chicken'], 'selection_type' => 'multiple', 'supports_quantity' => true],
            ['name' => 'Snack Add-ons', 'categories' => ['snacks'], 'selection_type' => 'multiple', 'supports_quantity' => false],
            ['name' => 'Noodle Add-ons', 'categories' => ['noodles'], 'selection_type' => 'multiple', 'supports_quantity' => false],
            ['name' => 'Drink Size', 'categories' => ['fruity-soda-milk', 'fresh-lemonade'], 'selection_type' => 'single', 'supports_quantity' => false],
        ];

        foreach ($groups as $group) {
            DB::table('addon_groups')->insertOrIgnore([
                'name' => $group['name'],
                'selection_type' => $group['selection_type'],
                'supports_quantity' => $group['supports_quantity'],
                'applicable_categories' => json_encode($group['categories']),
                'is_active' => true,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $addons = [
            ['group' => 'Meal Add-ons', 'name' => 'Extra Rice', 'price' => 39],
            ['group' => 'Meal Add-ons', 'name' => 'Extra Sauce', 'price' => 68],
            ['group' => 'Meal Add-ons', 'name' => 'Extra Piece / Extra Viand', 'price' => 89],
            ['group' => 'Meal Add-ons', 'name' => 'Drink Pairing', 'price' => 49],
            ['group' => 'Snack Add-ons', 'name' => 'Extra Dip/Sauce', 'price' => 25],
            ['group' => 'Snack Add-ons', 'name' => 'Large', 'price' => 35],
            ['group' => 'Noodle Add-ons', 'name' => 'Extra Toppings', 'price' => 45],
            ['group' => 'Noodle Add-ons', 'name' => 'Spice Level Upgrade', 'price' => 0],
            ['group' => 'Drink Size', 'name' => 'Large', 'price' => 20],
        ];

        foreach ($addons as $addon) {
            $groupId = DB::table('addon_groups')->where('name', $addon['group'])->value('id');
            if ($groupId) {
                DB::table('addons')->insertOrIgnore([
                    'addon_group_id' => $groupId,
                    'name' => $addon['name'],
                    'price' => $addon['price'],
                    'is_active' => true,
                    'sort_order' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Configuration rows are intentionally retained to avoid removing user changes.
    }
};
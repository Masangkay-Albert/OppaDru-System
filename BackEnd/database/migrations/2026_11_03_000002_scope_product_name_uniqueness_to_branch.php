<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const BRANCH_INDEX = 'products_branch_name_unique_ci';
    private const LEGACY_INDEX = 'products_name_unique_ci';

    public function up(): void
    {
        if (! Schema::hasTable('products')
            || ! Schema::hasColumn('products', 'franchise_id')
            || DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS '.self::LEGACY_INDEX);
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS '.self::BRANCH_INDEX
            .' ON products (LOWER(TRIM(name)), COALESCE(franchise_id, \'\'))'
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable('products')
            || ! Schema::hasColumn('products', 'franchise_id')
            || DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        $hasDuplicateNames = DB::table('products')
            ->selectRaw('LOWER(TRIM(name))')
            ->groupByRaw('LOWER(TRIM(name))')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        if ($hasDuplicateNames) {
            throw new RuntimeException('Cannot restore global product-name uniqueness while different branches have same-named products.');
        }

        DB::statement('DROP INDEX IF EXISTS '.self::BRANCH_INDEX);
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS '.self::LEGACY_INDEX
            .' ON products (LOWER(TRIM(name)))'
        );
    }
};

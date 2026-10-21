<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const FOREIGN_KEY = 'orders_branch_id_foreign';

    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('franchises')
            || ! Schema::hasColumn('orders', 'branch_id') || ! Schema::hasColumn('franchises', 'id')
            || DB::getDriverName() !== 'pgsql') {
            return;
        }

        $columns = DB::select(
            'SELECT table_name, data_type, character_maximum_length, numeric_precision, numeric_scale
             FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND ((table_name = ? AND column_name = ?) OR (table_name = ? AND column_name = ?))',
            ['orders', 'branch_id', 'franchises', 'id']
        );
        $types = collect($columns)->keyBy('table_name');
        $branchType = $types->get('orders');
        $franchiseType = $types->get('franchises');

        if (! $branchType || ! $franchiseType
            || $branchType->data_type !== $franchiseType->data_type
            || $branchType->character_maximum_length !== $franchiseType->character_maximum_length
            || $branchType->numeric_precision !== $franchiseType->numeric_precision
            || $branchType->numeric_scale !== $franchiseType->numeric_scale) {
            Log::warning('Skipped orders.branch_id foreign key because its type does not match franchises.id.', [
                'orders.branch_id' => $branchType,
                'franchises.id' => $franchiseType,
            ]);

            return;
        }

        $hasForeignKey = DB::table('information_schema.table_constraints')
            ->where('constraint_schema', DB::raw('current_schema()'))
            ->where('table_name', 'orders')
            ->where('constraint_name', self::FOREIGN_KEY)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
        if ($hasForeignKey) {
            return;
        }

        $hasOrphans = DB::table('orders as order_rows')
            ->leftJoin('franchises', 'franchises.id', '=', 'order_rows.branch_id')
            ->whereNotNull('order_rows.branch_id')
            ->whereNull('franchises.id')
            ->exists();
        if ($hasOrphans) {
            Log::warning('Skipped orders.branch_id foreign key because orphan branch IDs exist.');

            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->foreign('branch_id', self::FOREIGN_KEY)
                ->references('id')
                ->on('franchises');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders') || DB::getDriverName() !== 'pgsql') {
            return;
        }

        $hasForeignKey = DB::table('information_schema.table_constraints')
            ->where('constraint_schema', DB::raw('current_schema()'))
            ->where('table_name', 'orders')
            ->where('constraint_name', self::FOREIGN_KEY)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
        if ($hasForeignKey) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->dropForeign(self::FOREIGN_KEY);
            });
        }
    }
};

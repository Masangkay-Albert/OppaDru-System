<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillOrderBranchIds extends Command
{
    protected $signature = 'orders:backfill-branch-id {--dry-run : Report eligible orders without changing them}';

    protected $description = 'Backfill null order branch IDs from valid legacy franchise IDs';

    public function handle(): int
    {
        $eligible = DB::table('orders')
            ->whereNull('branch_id')
            ->whereNotNull('franchise_id')
            ->whereExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('franchises')
                    ->whereColumn('franchises.id', 'orders.franchise_id');
            });

        $count = (clone $eligible)->count();
        $this->info("Orders eligible for backfill: {$count}");

        if ($this->option('dry-run')) {
            $this->info('Dry run: no order rows were changed.');

            return self::SUCCESS;
        }

        $updated = $eligible->update(['branch_id' => DB::raw('franchise_id')]);
        $unresolved = DB::table('orders')->whereNull('branch_id')->count();

        $this->info("Orders backfilled: {$updated}");
        $this->info("Orders still without a branch: {$unresolved}");

        return self::SUCCESS;
    }
}

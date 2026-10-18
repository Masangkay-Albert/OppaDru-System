<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['franchises', 'franchise_accounts'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'address')) {
                continue;
            }

            DB::table($table)
                ->where('address', 'like', '%Ã%')
                ->orderBy('id')
                ->chunkById(100, function ($rows) use ($table): void {
                    foreach ($rows as $row) {
                        $address = str_replace(
                            ['Ã±', 'Ã‘'],
                            ['ñ', 'Ñ'],
                            (string) $row->address,
                        );
                        if ($address !== $row->address) {
                            DB::table($table)->where('id', $row->id)->update(['address' => $address]);
                        }
                    }
                });
        }
    }

    public function down(): void
    {
        // Address text is data; reverting a repaired Unicode value would be destructive.
    }
};

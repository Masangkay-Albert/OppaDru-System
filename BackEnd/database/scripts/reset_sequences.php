<?php

use Illuminate\Support\Facades\DB;

echo "Resetting sequences...\n";

$tables = ['addon_groups', 'addons', 'admin', 'drivers', 'employees', 'franchise_inventory', 'franchises', 'products', 'users'];

foreach ($tables as $table) {
    try {
        $cols = DB::select("
            SELECT a.attname as column_name, pg_get_serial_sequence(c.relname, a.attname) as seq
            FROM pg_class c
            JOIN pg_attribute a ON a.attrelid = c.oid
            WHERE c.relname = ?
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND pg_get_serial_sequence(c.relname, a.attname) IS NOT NULL
        ", [$table]);

        foreach ($cols as $col) {
            $maxVal = DB::table($table)->max($col->column_name);
            if ($maxVal) {
                DB::statement("SELECT setval('" . $col->seq . "', " . $maxVal . ")");
                echo "  ✅ Reset " . $col->seq . " to $maxVal\n";
            }
        }
    } catch (\Exception $e) {
        echo "  ⚠️ Warning for $table: " . $e->getMessage() . "\n";
    }
}

echo "\nDone resetting sequences!\n";


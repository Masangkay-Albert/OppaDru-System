<?php

/**
 * Data Migration Script: Old Supabase → New Supabase
 * 
 * This script reads all data from the old database and inserts it
 * into the new database. Tables are processed in dependency order
 * to respect foreign key constraints.
 * 
 * Usage: php artisan tinker < database/scripts/migrate_data.php
 */

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "=== Starting Data Migration from Old DB to New DB ===\n\n";

// Get all tables from the old database (public schema only)
$oldTables = DB::connection('old_pgsql')
    ->select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");

$tableNames = array_map(fn($t) => $t->tablename, $oldTables);

echo "Found " . count($tableNames) . " tables in old database:\n";
foreach ($tableNames as $t) {
    echo "  - $t\n";
}
echo "\n";

// Skip the migrations table - we already ran fresh migrations
$skipTables = ['migrations'];

// Disable foreign key checks temporarily
DB::statement('SET session_replication_role = replica;');

$totalRows = 0;
$errors = [];

foreach ($tableNames as $table) {
    if (in_array($table, $skipTables)) {
        echo "⏭️  Skipping: $table\n";
        continue;
    }

    // Check if table exists in new DB
    if (!Schema::hasTable($table)) {
        echo "⚠️  Table '$table' does not exist in new DB, skipping.\n";
        continue;
    }

    try {
        // Count rows in old table
        $count = DB::connection('old_pgsql')->table($table)->count();

        if ($count === 0) {
            echo "📭 $table: empty, skipping.\n";
            continue;
        }

        echo "📦 $table: migrating $count rows... ";

        // Clear any existing data in new table
        DB::table($table)->truncate();

        // Chunk the data to avoid memory issues
        $chunkSize = 500;
        $inserted = 0;

        DB::connection('old_pgsql')->table($table)->orderBy(
            DB::connection('old_pgsql')->raw('ctid')
        )->chunk($chunkSize, function ($rows) use ($table, &$inserted) {
            $data = json_decode(json_encode($rows), true);
            DB::table($table)->insert($data);
            $inserted += count($data);
        });

        echo "✅ $inserted rows migrated.\n";
        $totalRows += $inserted;

    } catch (\Exception $e) {
        $msg = $e->getMessage();
        echo "❌ Error: " . substr($msg, 0, 120) . "\n";
        $errors[] = ['table' => $table, 'error' => $msg];
    }
}

// Reset sequences for all tables with serial/identity columns
echo "\n🔄 Resetting sequences...\n";
$sequences = DB::select("
    SELECT sequence_name, column_name, table_name
    FROM information_schema.columns
    WHERE column_default LIKE 'nextval%'
    AND table_schema = 'public'
");

foreach ($sequences as $seq) {
    try {
        $maxId = DB::table($seq->table_name)->max($seq->column_name);
        if ($maxId) {
            // Extract sequence name from default
            $seqName = DB::selectOne("
                SELECT pg_get_serial_sequence('{$seq->table_name}', '{$seq->column_name}') as seq
            ");
            if ($seqName && $seqName->seq) {
                DB::statement("SELECT setval('{$seqName->seq}', $maxId)");
                echo "  ✅ Reset {$seqName->seq} to $maxId\n";
            }
        }
    } catch (\Exception $e) {
        echo "  ⚠️  Could not reset sequence for {$seq->table_name}.{$seq->column_name}: " . $e->getMessage() . "\n";
    }
}

// Re-enable foreign key checks
DB::statement('SET session_replication_role = DEFAULT;');

echo "\n=== Migration Complete ===\n";
echo "Total rows migrated: $totalRows\n";

if (!empty($errors)) {
    echo "\n⚠️  Errors encountered:\n";
    foreach ($errors as $err) {
        echo "  - {$err['table']}: {$err['error']}\n";
    }
}

echo "\nDone!\n";


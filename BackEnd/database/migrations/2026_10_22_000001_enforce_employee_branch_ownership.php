<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees') || ! Schema::hasColumn('employees', 'franchise_id')) {
            return;
        }

        $unassignedCount = DB::table('employees')->whereNull('franchise_id')->count();
        if ($unassignedCount > 0) {
            throw new \RuntimeException(
                "Cannot require employees.franchise_id: {$unassignedCount} employee(s) are unassigned. Review them manually before retrying this migration."
            );
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE employees ALTER COLUMN franchise_id SET NOT NULL');
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION prevent_employee_franchise_change()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    IF NEW.franchise_id IS DISTINCT FROM OLD.franchise_id THEN
                        RAISE EXCEPTION 'Employee branch assignment is immutable';
                    END IF;

                    RETURN NEW;
                END;
                $$;
                SQL);
            DB::statement(<<<'SQL'
                CREATE TRIGGER employees_franchise_id_immutable
                BEFORE UPDATE OF franchise_id ON employees
                FOR EACH ROW
                EXECUTE FUNCTION prevent_employee_franchise_change()
                SQL);

            return;
        }

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('franchise_id', 100)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('employees') || ! Schema::hasColumn('employees', 'franchise_id')) {
            return;
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TRIGGER IF EXISTS employees_franchise_id_immutable ON employees');
            DB::statement('DROP FUNCTION IF EXISTS prevent_employee_franchise_change()');
            DB::statement('ALTER TABLE employees ALTER COLUMN franchise_id DROP NOT NULL');

            return;
        }

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('franchise_id', 100)->nullable()->change();
        });
    }
};

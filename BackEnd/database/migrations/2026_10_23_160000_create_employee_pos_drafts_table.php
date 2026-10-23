<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employee_pos_drafts')) {
            Schema::create('employee_pos_drafts', function (Blueprint $table): void {
                $table->string('employee_id', 100);
                $table->string('franchise_id', 100);
                $table->uuid('browser_session_id');
                if (DB::getDriverName() === 'pgsql') {
                    $table->jsonb('draft_data');
                } else {
                    $table->json('draft_data');
                }
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('updated_at')->useCurrent();
                $table->primary(['employee_id', 'browser_session_id'], 'employee_pos_drafts_pkey');
                $table->index('franchise_id', 'employee_pos_drafts_franchise_id_idx');
            });
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            "ALTER TABLE employee_pos_drafts ALTER COLUMN draft_data SET DEFAULT '{\"cart\":{},\"favorite_ids\":[],\"include_cutlery\":false}'::jsonb"
        );
        DB::statement('ALTER TABLE employee_pos_drafts ENABLE ROW LEVEL SECURITY');
        DB::statement('REVOKE ALL ON employee_pos_drafts FROM anon, authenticated');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON employee_pos_drafts TO service_role');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.set_employee_pos_drafts_updated_at()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $function$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $function$
        SQL);
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS employee_pos_drafts_updated_at ON employee_pos_drafts;
            CREATE TRIGGER employee_pos_drafts_updated_at
            BEFORE UPDATE ON employee_pos_drafts
            FOR EACH ROW EXECUTE FUNCTION public.set_employee_pos_drafts_updated_at()
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql' && Schema::hasTable('employee_pos_drafts')) {
            DB::unprepared('DROP TRIGGER IF EXISTS employee_pos_drafts_updated_at ON employee_pos_drafts');
            DB::unprepared('DROP FUNCTION IF EXISTS public.set_employee_pos_drafts_updated_at()');
        }

        Schema::dropIfExists('employee_pos_drafts');
    }
};

<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class EmployeePosDraftService
{
    public function isConfigured(): bool
    {
        return filled(config('services.supabase.url'))
            && filled(config('services.supabase.service_role_key'));
    }

    public function find(string $employeeId, string $franchiseId, string $browserSessionId): array
    {
        $response = $this->request()->get($this->tableUrl(), [
            'select' => 'draft_data',
            'employee_id' => 'eq.'.$employeeId,
            'franchise_id' => 'eq.'.$franchiseId,
            'browser_session_id' => 'eq.'.$browserSessionId,
            'limit' => 1,
        ])->throw();

        $draft = $response->json('0.draft_data');

        return is_array($draft) ? $draft : [
            'cart' => [],
            'favorite_ids' => [],
            'include_cutlery' => false,
        ];
    }

    public function save(string $employeeId, string $franchiseId, array $validatedDraft): array
    {
        $draft = [
            'cart' => $validatedDraft['cart'],
            'favorite_ids' => $validatedDraft['favorite_ids'],
            'include_cutlery' => (bool) $validatedDraft['include_cutlery'],
        ];

        $response = $this->request()
            ->withHeaders(['Prefer' => 'resolution=merge-duplicates,return=representation'])
            ->post($this->tableUrl().'?on_conflict=employee_id,browser_session_id', [
                'employee_id' => $employeeId,
                'franchise_id' => $franchiseId,
                'browser_session_id' => $validatedDraft['browser_session_id'],
                'draft_data' => $draft,
            ])
            ->throw();

        $savedDraft = $response->json('0.draft_data');

        return is_array($savedDraft) ? $savedDraft : $draft;
    }

    private function request(): PendingRequest
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Supabase cashier draft storage is not configured.');
        }

        $key = (string) config('services.supabase.service_role_key');

        return Http::acceptJson()
            ->asJson()
            ->timeout(8)
            ->withHeaders([
                'apikey' => $key,
                'Authorization' => 'Bearer '.$key,
            ]);
    }

    private function tableUrl(): string
    {
        return rtrim((string) config('services.supabase.url'), '/').'/rest/v1/employee_pos_drafts';
    }
}

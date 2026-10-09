<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

trait FranchiseApplicationOpportunityActions
{
    public function opportunities()
    {
        $settings = SystemSetting::whereIn('key', [
            'franchise_investment_minimum',
            'franchise_investment_maximum',
            'franchise_program_fee',
            'franchise_program_requirements',
            'franchise_program_qualifications',
            'franchise_program_business_rules',
            'franchise_program_support',
        ])->pluck('value', 'key');

        $investment = [
            'minimum' => $settings->get('franchise_investment_minimum') !== '' ? $settings->get('franchise_investment_minimum') : null,
            'maximum' => $settings->get('franchise_investment_maximum') !== '' ? $settings->get('franchise_investment_maximum') : null,
        ];

        if ($investment['minimum'] === null && $investment['maximum'] === null) {
            $investment = null;
        }

        return response()->json([
            'data' => [
                'investment' => $investment,
                'franchise_fee' => $settings->get('franchise_program_fee') !== '' ? $settings->get('franchise_program_fee') : null,
                'requirements' => $this->programList($settings->get('franchise_program_requirements'), [
                    'A verified account and accurate applicant contact details.',
                    'A realistic investment plan and willingness to complete the review process.',
                    'Commitment to required training, permits, and operating standards before opening.',
                ]),
                'qualifications' => $this->programList($settings->get('franchise_program_qualifications'), [
                    'Business or leadership experience relevant to operating a restaurant.',
                    'Financial readiness for the agreed investment and location-specific costs.',
                    'Willingness to complete interviews, due diligence, and location assessment.',
                ]),
                'business_rules' => $this->programList($settings->get('franchise_program_business_rules'), [
                    'Applications are reviewed individually and do not guarantee approval.',
                    'No franchise access or operation is permitted before authorized activation.',
                    'Fees and opening conditions are governed by the signed franchise agreement.',
                ]),
                'support' => $this->programList($settings->get('franchise_program_support'), [
                    'Brand, product, and operating standards orientation.',
                    'Franchisee and staff training before opening.',
                    'Guidance through location assessment and opening readiness.',
                ]),
                'steps' => [
                    'The franchisor publishes the current program, fees, qualifications, requirements, business rules, and support.',
                    'The applicant submits personal and business information with a proposed location.',
                    'The franchise team reviews financial readiness, experience, and site suitability; interviews or more information may be requested.',
                    'The franchisor approves conditionally or rejects the application after due diligence.',
                    'Both parties review and sign the franchise agreement.',
                    'The franchisee completes applicable payments, permits, location work, equipment, and staffing.',
                    'The franchisee and staff complete required training and system setup.',
                    'The franchisor inspects opening readiness and issues opening approval.',
                    'An authorized administrator activates the franchise; operations and compliance are monitored thereafter.',
                ],
                'faqs' => [
                    [
                        'question' => 'How long does the review take?',
                        'answer' => 'Timing depends on the completeness of your information and any required interview or location assessment. The team will provide updates in My Applications.',
                    ],
                    [
                        'question' => 'Do I need a property before applying?',
                        'answer' => 'No. Tell us whether you have a proposed property; the team can evaluate a site later in the process.',
                    ],
                    [
                        'question' => 'When can I operate a franchise?',
                        'answer' => 'Only after approval, applicable agreement and requirements, opening-readiness checks, and activation by an authorized administrator.',
                    ],
                ],
            ],
        ]);
    }

    public function updateOpportunitySettings(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'investment_minimum' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
            'investment_maximum' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
            'franchise_fee' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
            'requirements' => 'sometimes|nullable|string|max:10000',
            'qualifications' => 'sometimes|nullable|string|max:10000',
            'business_rules' => 'sometimes|nullable|string|max:10000',
            'support' => 'sometimes|nullable|string|max:10000',
        ]);
        $validator->after(function ($validator) use ($request) {
            $minimum = $request->input('investment_minimum');
            $maximum = $request->input('investment_maximum');
            if (is_numeric($minimum) && is_numeric($maximum) && (float) $minimum > (float) $maximum) {
                $validator->errors()->add('investment_maximum', 'The maximum investment must be at least the minimum investment.');
            }
        });
        if ($validator->fails()) {
            return response()->json(['message' => 'Investment settings are invalid.', 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request) {
            foreach ([
                'investment_minimum' => 'franchise_investment_minimum',
                'investment_maximum' => 'franchise_investment_maximum',
                'franchise_fee' => 'franchise_program_fee',
            ] as $field => $key) {
                if ($request->exists($field)) {
                    $value = $request->input($field);
                    SystemSetting::updateOrCreate(
                        ['key' => $key],
                        ['value' => $value === null || $value === '' ? '' : number_format((float) $value, 2, '.', '')],
                    );
                }
            }

            foreach ([
                'requirements' => 'franchise_program_requirements',
                'qualifications' => 'franchise_program_qualifications',
                'business_rules' => 'franchise_program_business_rules',
                'support' => 'franchise_program_support',
            ] as $field => $key) {
                if ($request->exists($field)) {
                    SystemSetting::updateOrCreate(
                        ['key' => $key],
                        ['value' => trim((string) $request->input($field))],
                    );
                }
            }
        });

        return $this->opportunities();
    }

    private function programList(?string $value, array $defaults): array
    {
        $items = array_values(array_filter(
            array_map('trim', preg_split('/\r\n|\r|\n/', (string) $value) ?: []),
            static fn (string $item): bool => $item !== '',
        ));

        return $items !== [] ? $items : $defaults;
    }
}

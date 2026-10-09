<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

trait FranchiseApplicationOpportunityActions
{
    public function opportunities()
    {
        $settings = SystemSetting::whereIn('key', [
            'franchise_investment_minimum',
            'franchise_investment_maximum',
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
                'requirements' => [
                    'A verified account and accurate applicant contact details.',
                    'Business or leadership experience relevant to operating a restaurant.',
                    'A realistic investment plan and willingness to complete the review process.',
                    'A proposed site, or readiness to work with the team to assess one.',
                    'Commitment to required training, permits, and operating standards before opening.',
                ],
                'steps' => [
                    'Submit your application and supporting information.',
                    'Application and financial-readiness review.',
                    'Follow-up information, interview, and proposed-location assessment as needed.',
                    'Conditional decision, agreement, and outstanding requirements.',
                    'Opening-readiness review and activation by an authorized administrator.',
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

        foreach ([
            'investment_minimum' => 'franchise_investment_minimum',
            'investment_maximum' => 'franchise_investment_maximum',
        ] as $field => $key) {
            if ($request->exists($field)) {
                $value = $request->input($field);
                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $value === null || $value === '' ? '' : number_format((float) $value, 2, '.', '')],
                );
            }
        }

        return $this->opportunities();
    }
}

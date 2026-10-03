<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class FranchiseService
{
    public function buildSlug(string $name): string
    {
        return Str::slug($name ?: 'franchise');
    }

    public function scopeProductQuery(Builder $query, ?string $franchiseId, bool $includeMainBranch = true): Builder
    {
        if (!$franchiseId) {
            return $query;
        }

        return $query->where(function ($q) use ($franchiseId, $includeMainBranch) {
            if ($includeMainBranch) {
                $q->whereNull('franchise_id');
            }

            $q->orWhere('franchise_id', $franchiseId);
        });
    }

    public function scopeOrderQuery(Builder $query, ?string $franchiseId): Builder
    {
        if (!$franchiseId) {
            return $query;
        }

        return $query->where('franchise_id', $franchiseId);
    }
}

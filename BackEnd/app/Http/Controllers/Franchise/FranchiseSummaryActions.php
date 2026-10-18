<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;

trait FranchiseSummaryActions
{
    public function activeBranches()
    {
        return response()->json([
            'data' => Franchise::where('status', 'active')
                // The main store is selected by the empty option in the customer menu.
                // Only franchise locations belong in this list.
                ->whereNotNull('franchise_account_id')
                ->where(function ($query) {
                    $query->whereNull('is_main')->orWhere('is_main', false);
                })
                ->whereHas('franchiseAccount', fn ($accountQuery) => $accountQuery->where('status', 'active'))
                ->orderBy('name')
                ->get(['id', 'name', 'address']),
        ]);
    }

    public function managementInformation(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser) {
            return response()->json(['message' => 'Franchise manager access required.'], 403);
        }

        // A franchise session is branch-scoped. Do not expose sibling locations
        // from the shared franchise account to a portal user.
        $user->load(['franchise', 'franchiseAccount']);
        $locations = collect([$user->franchise])->filter()->values();

        return response()->json([
            'data' => [
                'franchise' => $user->franchiseAccount,
                'assigned_location' => $user->franchise,
                'locations' => $locations,
                'manager' => $user->makeHidden(['password', 'api_token']),
            ],
        ]);
    }

    public function index(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => Franchise::orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function show(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);

        return response()->json(['data' => $franchise]);
    }

    public function stats(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $statusBreakdown = Franchise::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'data' => [
                'total_franchises' => Franchise::count(),
                'active_franchises' => Franchise::where('status', 'active')->count(),
                'pending_franchises' => Franchise::where('status', 'pending')->count(),
                'inactive_franchises' => Franchise::where('status', 'inactive')->count(),
                'total_franchise_users' => FranchiseUser::count(),
                'active_franchise_users' => FranchiseUser::where('is_active', true)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'branch_products' => Product::whereNotNull('franchise_id')->count(),
                'franchise_orders' => Order::whereNotNull('franchise_id')->count(),
                'status_breakdown' => $statusBreakdown,
            ],
        ]);
    }

    public function summary(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);

        return response()->json([
            'data' => $this->franchiseSummaryData($franchise),
        ]);
    }

    public function branchSummary(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);

        return response()->json([
            'data' => $this->franchiseSummaryData($franchise),
        ]);
    }

    private function franchiseSummaryData(Franchise $franchise): array
    {
        $orders = fn () => Order::where('branch_id', $franchise->id);

        return [
            'franchise_id' => $franchise->id,
            'franchise_name' => $franchise->name,
            'total_users' => $franchise->users()->count(),
            'active_users' => $franchise->users()->where('is_active', true)->count(),
            'total_products' => Product::where('franchise_id', $franchise->id)->count(),
            'shared_products' => Product::whereNull('franchise_id')->count(),
            'total_orders' => $orders()->count(),
            'total_revenue' => (float) $orders()->countedAsRevenue()->sum('total'),
            'average_order_value' => (float) $orders()->countedAsRevenue()->avg('total'),
            'status_breakdown' => $orders()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
        ];
    }
}

<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\EmployeeAuthController;
use App\Http\Controllers\DriverController;
use App\Http\Controllers\TargetProfitSaleController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\AddonController;
use App\Http\Controllers\DriverAuthController;
use App\Http\Controllers\KitchenOrderController;
use App\Http\Controllers\DriverOrderController;
use App\Http\Controllers\DeliveryProofController;
use App\Http\Controllers\DiscountVerificationController;
use App\Http\Controllers\DiscountApplicationController;
use App\Http\Controllers\ProofImageController;
use App\Http\Controllers\FranchiseApplicationController;
use App\Http\Controllers\FranchiseAuthController;
use App\Http\Controllers\FranchiseApplicantAuthController;
use App\Http\Controllers\FranchiseController;
use App\Http\Controllers\FranchiseAccountController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\BranchRoutingController;
use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\PromoController;
use App\Http\Controllers\PopularMealsController;
use Illuminate\Http\Request;


Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::get('/storage/{path}', function (string $path) {
    $filePath = storage_path('app/public/' . $path);
    if (!file_exists($filePath)) {
        abort(404);
    }
    $mimeType = mime_content_type($filePath) ?: 'image/png';
    return response()->file($filePath, ['Content-Type' => $mimeType]);
})->where('path', '.*');

Route::get('/settings/pricing', [SettingController::class, 'index']);
Route::get('/promos', [PromoController::class, 'index']);
Route::post('/promos/validate', [PromoController::class, 'validatePromo']);
Route::get('/reports/popular-meals', [PopularMealsController::class, 'getMostPopularThisMonth']);
Route::get('/cashier/popular-meals', [PopularMealsController::class, 'getMostPopularThisMonth']);
Route::get('/announcements', [AnnouncementController::class, 'publicList']);
Route::get('/franchise-opportunities', [FranchiseApplicationController::class, 'opportunities']);
Route::get('/geo/provinces', [FranchiseApplicationController::class, 'provinces']);
Route::get('/geo/cities', [FranchiseApplicationController::class, 'cities']);
Route::get('/geo/barangays', [FranchiseApplicationController::class, 'barangays']);
Route::get('/geo/nominatim/search', [GeocodingController::class, 'search'])->middleware('throttle:60,1');
Route::get('/geo/nominatim/reverse', [GeocodingController::class, 'reverse'])->middleware('throttle:60,1');
Route::post('/franchise-applications/track', [FranchiseApplicationController::class, 'trackByReference'])->middleware('throttle:30,1,franchise-track-lookup');
Route::post('/franchise-applications/track/documents', [FranchiseApplicationController::class, 'respond'])->middleware('throttle:5,1,franchise-track-documents');
Route::post('/franchise-applications/track/document-template', [FranchiseApplicationController::class, 'downloadTrackedRequiredDocumentTemplate'])->middleware('throttle:10,1,franchise-track-template');
Route::post('/franchise-applications/track/payment-proof', [FranchiseApplicationController::class, 'submitPaymentProof'])->middleware('throttle:5,1,franchise-track-payment');
Route::post('/franchise-applicants/register', [FranchiseApplicantAuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/franchise-applicants/login', [FranchiseApplicantAuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/franchise-applicants/verification/resend', [FranchiseApplicantAuthController::class, 'resendVerification'])->middleware('throttle:6,1');
Route::get('/franchises/active', [FranchiseController::class, 'activeBranches']);
Route::post('/branches/resolve', [BranchRoutingController::class, 'resolve']);

Route::prefix('franchise')->group(function () {
    Route::post('/login', [FranchiseAuthController::class, 'login'])->middleware('throttle:5,1,franchise-login');
    Route::post('/logout', [FranchiseAuthController::class, 'logout']);

    Route::middleware(['franchise.access'])->group(function () {
        Route::get('/me', [FranchiseAuthController::class, 'me']);
        Route::get('/management', [FranchiseController::class, 'managementInformation']);
        Route::get('/dashboard', [FranchiseController::class, 'dashboard']);
        Route::get('/summary', [FranchiseController::class, 'branchSummary']);
        Route::get('/inventory', [FranchiseController::class, 'inventorySummary']);
        Route::patch('/inventory/{productId}', [FranchiseController::class, 'updateInventory']);
        Route::get('/fulfillment', [FranchiseController::class, 'fulfillmentSummary']);
        Route::get('/reports', [FranchiseController::class, 'branchReports'])->middleware('franchise.role:owner,manager');
        Route::get('/users', [FranchiseController::class, 'branchUsers'])->middleware('franchise.role:owner,manager');
        Route::post('/users', [FranchiseController::class, 'storeBranchUser'])->middleware('franchise.role:owner,manager');
        Route::patch('/users/{type}/{id}/status', [FranchiseController::class, 'updateBranchUserStatus'])->middleware('franchise.role:owner,manager');
        Route::patch('/users/employee/{id}', [FranchiseController::class, 'updateBranchEmployee'])->middleware('franchise.role:owner,manager');
        Route::put('/users/{type}/{id}/password', [FranchiseController::class, 'resetBranchUserPassword'])->middleware('franchise.role:owner,manager');
        Route::delete('/users/{type}/{id}', [FranchiseController::class, 'deleteBranchUser'])->middleware('franchise.role:owner,manager');
        Route::get('/settings', [FranchiseController::class, 'branchSettings'])->middleware('franchise.role:owner');
        Route::put('/settings', [FranchiseController::class, 'updateBranchSettings'])->middleware('franchise.role:owner');
        Route::get('/addon-groups', [AddonController::class, 'index']);
        Route::get('/products', [FranchiseController::class, 'products']);
        Route::post('/products', [ProductController::class, 'franchiseStore'])->middleware('franchise.role:owner,manager');
        Route::post('/products/upload-image', [ProductController::class, 'franchiseUploadImage'])->middleware('franchise.role:owner,manager');
        // Franchise users can change branch availability/stock; product creation is branch-scoped.
        Route::patch('/products/{id}/toggle', [ProductController::class, 'franchiseToggleAvailability']);
        Route::get('/orders', [FranchiseController::class, 'orders']);
        Route::get('/orders/{id}', [FranchiseController::class, 'showOrder']);
        Route::post('/pos/orders', [FranchiseController::class, 'storePosOrder']);
        Route::get('/pos/orders', [FranchiseController::class, 'franchisePosOrders']);
        Route::post('/pos/payments/gcash', [FranchiseController::class, 'createPosPayment']);
    });

});

Route::post('/employee/login', [EmployeeAuthController::class, 'login']);
Route::post('/employee/logout', [EmployeeAuthController::class, 'logout']);
Route::middleware(['employee.access:cashier'])->group(function () {
    Route::get('/employee/pos/products', [FranchiseController::class, 'employeePosProducts']);
    Route::get('/employee/pos/orders', [FranchiseController::class, 'employeePosOrders']);
    Route::get('/employee/pos/addon-groups', [AddonController::class, 'index']);
    Route::post('/employee/pos/orders', [FranchiseController::class, 'storePosOrder']);
    Route::post('/employee/pos/payments/gcash', [FranchiseController::class, 'createPosPayment']);
});
Route::middleware(['admin.access'])->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/customers', [OrderController::class, 'getAllCustomers']);
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
    Route::put('/employees/{id}/reset-password', [EmployeeController::class, 'resetPassword']);
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
    Route::post('/drivers', [DriverController::class, 'store']);
    Route::put('/drivers/{id}', [DriverController::class, 'update']);
    Route::delete('/drivers/{id}', [DriverController::class, 'destroy']);
    Route::put('/drivers/{id}/reset-password', [DriverController::class, 'resetPassword']);
});
Route::post('/driver/login', [DriverAuthController::class, 'login']);
Route::post('/driver/logout', [DriverAuthController::class, 'logout']);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/verification/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:6,1');

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/available', [ProductController::class, 'getAvailable']);
Route::get('/products/category/{category}', [ProductController::class, 'getByCategory']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/addon-groups', [AddonController::class, 'index']);

Route::post('/orders/onsite', [OrderController::class, 'storeOnsite']);
Route::patch('/orders/{id}/status-update', [OrderController::class, 'updateStatusOnsite']);


/// KITCHEN
Route::middleware(['employee.access:kitchen_staff'])->group(function () {
    Route::get('/kitchen/orders', [KitchenOrderController::class, 'index']);
    Route::get('/kitchen/orders/counts', [KitchenOrderController::class, 'counts']);
    Route::patch('/kitchen/orders/{id}/status', [KitchenOrderController::class, 'updateStatus']);
    Route::patch('/kitchen/orders/{id}/schedule', [KitchenOrderController::class, 'reschedule']);
});

//drivers
Route::get('/driver/orders', [DriverOrderController::class, 'index']);
Route::patch('/driver/orders/{id}/status', [DriverOrderController::class, 'updateStatus']);
Route::post('/driver/orders/{id}/delivery-proof', [DeliveryProofController::class, 'store']);
Route::get('/orders/{id}/delivery-proof', [ProofImageController::class, 'delivery']);
Route::get('/orders/{id}/discount-proof', [ProofImageController::class, 'orderDiscount']);
Route::get('/discount-applications/{id}/proof-image', [ProofImageController::class, 'discountApplication']);
Route::get('/discount-verifications/{id}/proof-image', [ProofImageController::class, 'discountVerification']);


Route::get('/payment/order/{reference}', [PaymentController::class, 'getOrderByReference']);
Route::post('/payment/confirm/{reference}', [PaymentController::class, 'confirmPaymentFromMobile']);
Route::post('/payment/gcash/create', [PaymentController::class, 'createGCashPayment']);
Route::post('/payment/gcash/webhook', [PaymentController::class, 'webhook']);
Route::get('/payment/status/{reference}', [PaymentController::class, 'getPaymentStatus']);

Route::middleware(['auth:api', 'verified-user'])->group(function () {
    Route::get('/orders/user', [OrderController::class, 'getUserOrders']);
    Route::get('/orders/user/{id}', [OrderController::class, 'getUserOrder']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);
    Route::put('/settings/pricing', [SettingController::class, 'update']);

    Route::post('/orders', [OrderController::class, 'store']);
    Route::put('/orders/{id}', [OrderController::class, 'update']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);
    Route::post('/orders/{id}/discount-verification', [DiscountVerificationController::class, 'store']);
    Route::get('/discount/applications/me', [DiscountApplicationController::class, 'myApplications']);
    Route::post('/discount/applications', [DiscountApplicationController::class, 'store']);
    Route::delete('/discount/applications/me', [DiscountApplicationController::class, 'destroyMine']);

    Route::post('/payment/gcash/request-otp', [PaymentController::class, 'requestGCashOTP']);
    Route::post('/payment/gcash/verify', [PaymentController::class, 'verifyGCash']);
    Route::post('/payment/card/process', [PaymentController::class, 'processCard']);
    Route::get('/payment/history', [PaymentController::class, 'getPaymentHistory']);

});

Route::middleware('franchise.applicant.access')->group(function () {
    Route::get('/franchise-applicants/me', [FranchiseApplicantAuthController::class, 'me']);
    Route::post('/franchise-applicants/logout', [FranchiseApplicantAuthController::class, 'logout']);
    Route::post('/franchise-applications', [FranchiseApplicationController::class, 'store'])->middleware('throttle:5,1');
    Route::get('/franchise-applications/me', [FranchiseApplicationController::class, 'myApplications']);
    Route::get('/franchise-applications/me/{id}', [FranchiseApplicationController::class, 'showMine']);
    Route::post('/franchise-applications/me/{id}/response', [FranchiseApplicationController::class, 'respond']);
    Route::post('/franchise-applications/me/{id}/payment-proof', [FranchiseApplicationController::class, 'submitPaymentProof']);
    Route::get('/franchise-applications/me/{id}/required-documents/{document}/template', [FranchiseApplicationController::class, 'downloadRequiredDocumentTemplate']);
    Route::patch('/franchise-applications/me/{id}/withdraw', [FranchiseApplicationController::class, 'withdraw']);
    Route::get('/franchise-applications/{id}/documents/{document}', [FranchiseApplicationController::class, 'downloadDocument']);
});

Route::middleware(['admin.access'])->prefix('admin')->group(function () {
    Route::get('/branches/routing-diagnostics', [BranchRoutingController::class, 'diagnostics']);
    Route::get('/announcements', [AnnouncementController::class, 'index']);
    Route::post('/announcements', [AnnouncementController::class, 'store']);
    Route::get('/announcements/{id}', [AnnouncementController::class, 'show']);
    Route::post('/announcements/{id}', [AnnouncementController::class, 'update']);
    Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);
    Route::patch('/announcements/{id}/status', [AnnouncementController::class, 'toggleStatus']);
    Route::post('/announcements/{id}/publish-facebook', [AnnouncementController::class, 'publishToFacebook']);
    Route::get('/facebook/status', [AnnouncementController::class, 'getFacebookStatus']);

    Route::get('/promos', [PromoController::class, 'adminIndex']);
    Route::post('/promos', [PromoController::class, 'store']);
    Route::get('/promos/{id}', [PromoController::class, 'show']);
    Route::put('/promos/{id}', [PromoController::class, 'update']);
    Route::delete('/promos/{id}', [PromoController::class, 'destroy']);
    Route::patch('/promos/{id}/toggle-active', [PromoController::class, 'toggleActive']);

    Route::post('/addon-groups', [AddonController::class, 'storeGroup']);
    Route::put('/addon-groups/{addonGroup}', [AddonController::class, 'updateGroup']);
    Route::delete('/addon-groups/{addonGroup}', [AddonController::class, 'destroyGroup']);
    Route::post('/addon-groups/{addonGroup}/addons', [AddonController::class, 'store']);
    Route::put('/addons/{addon}', [AddonController::class, 'update']);
    Route::delete('/addons/{addon}', [AddonController::class, 'destroy']);
    Route::put('/products/{product}/addon-groups', [AddonController::class, 'assignProduct']);
    Route::get('/products', [ProductController::class, 'getAllForAdmin']);
    Route::get('/products/count', [ProductController::class, 'count']);
    Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);

    Route::delete('/customers/{id}', [AdminController::class, 'destroyCustomer']);
    Route::get('/list', [AdminController::class, 'index']);
    Route::get('/count', [AdminController::class, 'count']);
    Route::get('/discount-verifications', [DiscountVerificationController::class, 'index']);
    Route::patch('/discount-verifications/{id}', [DiscountVerificationController::class, 'updateStatus']);
    Route::get('/discount-applications', [DiscountApplicationController::class, 'index']);
    Route::patch('/discount-applications/{id}', [DiscountApplicationController::class, 'updateStatus']);
    Route::get('/target-profit-sales', [TargetProfitSaleController::class, 'show']);
    Route::put('/target-profit-sales', [TargetProfitSaleController::class, 'update']);
    Route::delete('/target-profit-sales', [TargetProfitSaleController::class, 'destroy']);

    Route::get('/franchises', [FranchiseController::class, 'index']);
    Route::get('/franchises/stats', [FranchiseController::class, 'stats']);
    Route::get('/franchises/{id}', [FranchiseController::class, 'show']);
    Route::get('/franchises/{id}/summary', [FranchiseController::class, 'summary']);
    Route::get('/franchises/{id}/inventory', [FranchiseController::class, 'inventoryOverview']);
    Route::get('/franchises/{id}/fulfillment', [FranchiseController::class, 'fulfillmentOverview']);
    Route::get('/franchises/{id}/users', [FranchiseController::class, 'users']);
    Route::post('/franchises/{id}/users', [FranchiseController::class, 'storeUser']);
    Route::put('/franchises/{id}/users/{userId}', [FranchiseController::class, 'updateUser']);
    Route::patch('/franchises/{id}/users/{userId}/toggle-status', [FranchiseController::class, 'toggleUserStatus']);
    Route::post('/franchises', [FranchiseController::class, 'store']);
    Route::put('/franchises/{id}', [FranchiseController::class, 'update']);
    Route::delete('/franchises/{id}', [FranchiseController::class, 'destroy']);
    Route::get('/franchise-applications', [FranchiseApplicationController::class, 'index']);
    Route::get('/franchise-applications/stats', [FranchiseApplicationController::class, 'stats']);
    Route::get('/franchise-applications/{id}', [FranchiseApplicationController::class, 'showAdmin']);
    Route::post('/franchise-applications/{id}/approve', [FranchiseApplicationController::class, 'approve']);
    Route::patch('/franchise-applications/{id}', [FranchiseApplicationController::class, 'review']);
    Route::patch('/franchise-applications/{id}/requirements', [FranchiseApplicationController::class, 'updateRequirements']);
    Route::get('/franchise-applications/{id}/required-documents/{document}/template', [FranchiseApplicationController::class, 'downloadRequirementTemplate']);
    Route::post('/franchise-applications/{id}/activate', [FranchiseApplicationController::class, 'activate']);
    Route::get('/franchise-applications/{id}/documents/{document}', [FranchiseApplicationController::class, 'downloadDocument']);
    Route::put('/franchise-opportunities', [FranchiseApplicationController::class, 'updateOpportunitySettings']);

    Route::get('/franchise-accounts', [FranchiseAccountController::class, 'index']);
    Route::post('/franchise-accounts', [FranchiseAccountController::class, 'store']);
    Route::get('/franchise-accounts/{id}', [FranchiseAccountController::class, 'show']);
    Route::put('/franchise-accounts/{id}', [FranchiseAccountController::class, 'update']);
    Route::post('/franchise-accounts/{id}/locations', [FranchiseAccountController::class, 'storeLocation']);
    Route::post('/franchise-accounts/{id}/managers', [FranchiseAccountController::class, 'storeManager']);
});

Route::prefix('admin')->group(function () {
    Route::post('/register', [AdminController::class, 'store']);
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
});

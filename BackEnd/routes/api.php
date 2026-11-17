<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomerPasswordRecoveryController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderReplacementController;
use App\Http\Controllers\CustomerNotificationController;
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
use App\Http\Controllers\MainBranchInventoryController;
use App\Http\Controllers\BranchInventoryController;
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
use App\Http\Controllers\StoreHoursController;
use Illuminate\Http\Request;


Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::get('/store-hours', [StoreHoursController::class, 'show']);

Route::get('/storage/{path}', function (string $path) {
    $filePath = storage_path('app/public/' . $path);
    if (!file_exists($filePath)) {
        abort(404);
    }
    $mimeType = mime_content_type($filePath) ?: 'image/png';
    return response()->file($filePath, ['Content-Type' => $mimeType]);
})->where('path', '.*');

Route::get('/settings/pricing', [SettingController::class, 'index']);
Route::post('/promos/validate', [PromoController::class, 'validatePromo'])
    ->middleware(['auth:api', 'throttle:30,1,promo-validation']);
Route::get('/reports/popular-meals', [PopularMealsController::class, 'getMostPopularThisMonth']);
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
        Route::get('/announcements', [AnnouncementController::class, 'franchiseList']);
        Route::post('/announcements/{id}/read', [AnnouncementController::class, 'markFranchiseRead']);
        Route::get('/management', [FranchiseController::class, 'managementInformation']);
        Route::get('/dashboard', [FranchiseController::class, 'dashboard']);
        Route::get('/summary', [FranchiseController::class, 'branchSummary']);
        Route::get('/inventory', [FranchiseController::class, 'inventorySummary']);
        Route::get('/inventory/ingredients', [BranchInventoryController::class, 'index']);
        Route::get('/inventory/ingredients/history', [BranchInventoryController::class, 'history']);
        Route::get('/inventory/ingredients/export', [BranchInventoryController::class, 'export']);
        Route::post('/inventory/ingredients/import', [BranchInventoryController::class, 'import'])->middleware('franchise.role:owner,manager');
        Route::post('/inventory/ingredients', [BranchInventoryController::class, 'store'])->middleware('franchise.role:owner,manager');
        Route::put('/inventory/ingredients/{ingredient}', [BranchInventoryController::class, 'update'])->middleware('franchise.role:owner,manager');
        Route::patch('/inventory/ingredients/{ingredient}/archive', [BranchInventoryController::class, 'archive'])->middleware('franchise.role:owner,manager');
        Route::post('/inventory/ingredients/{ingredient}/receive', [BranchInventoryController::class, 'receive'])->middleware('franchise.role:owner,manager');
        Route::post('/inventory/ingredients/{ingredient}/adjustments', [BranchInventoryController::class, 'adjust'])->middleware('franchise.role:owner,manager');
        Route::post('/inventory/restock-requests', [BranchInventoryController::class, 'requestRestock'])->middleware('franchise.role:owner,manager');
        Route::patch('/inventory/transfers/{transfer}/receive', [BranchInventoryController::class, 'receiveTransfer'])->middleware('franchise.role:owner,manager');
        Route::patch('/inventory/{productId}', [FranchiseController::class, 'updateInventory'])->middleware('franchise.role:owner,manager');
        Route::get('/fulfillment', [FranchiseController::class, 'fulfillmentSummary']);
        Route::get('/reports', [FranchiseController::class, 'branchReports'])->middleware('franchise.role:owner,manager');
        Route::put('/reports/sales-target', [FranchiseController::class, 'updateBranchSalesTarget'])->middleware('franchise.role:owner,manager');
        Route::delete('/reports/sales-target', [FranchiseController::class, 'deleteBranchSalesTarget'])->middleware('franchise.role:owner,manager');
        Route::get('/users', [FranchiseController::class, 'branchUsers'])->middleware('franchise.role:owner,manager');
        Route::post('/users', [FranchiseController::class, 'storeBranchUser'])->middleware('franchise.role:owner,manager');
        Route::patch('/users/{type}/{id}/status', [FranchiseController::class, 'updateBranchUserStatus'])->middleware('franchise.role:owner,manager');
        Route::patch('/users/employee/{id}', [FranchiseController::class, 'updateBranchEmployee'])->middleware('franchise.role:owner,manager');
        Route::put('/users/{type}/{id}/password', [FranchiseController::class, 'resetBranchUserPassword'])->middleware('franchise.role:owner,manager');
        Route::delete('/users/{type}/{id}', [FranchiseController::class, 'deleteBranchUser'])->middleware('franchise.role:owner,manager');
        Route::get('/settings', [FranchiseController::class, 'branchSettings'])->middleware('franchise.role:owner');
        Route::put('/settings', [FranchiseController::class, 'updateBranchSettings'])->middleware('franchise.role:owner');
        Route::get('/addon-groups', [AddonController::class, 'index']);
        Route::get('/products/archived', [ProductController::class, 'franchiseArchivedIndex'])->middleware('franchise.role:owner,manager');
        Route::get('/products', [FranchiseController::class, 'products']);
        Route::post('/products', [ProductController::class, 'franchiseStore'])->middleware('franchise.role:owner,manager');
        Route::post('/products/upload-image', [ProductController::class, 'franchiseUploadImage'])->middleware('franchise.role:owner,manager');
        Route::patch('/products/{id}/archive', [ProductController::class, 'franchiseArchive'])->middleware('franchise.role:owner,manager');
        Route::patch('/products/{id}/restore', [ProductController::class, 'franchiseRestore'])->middleware('franchise.role:owner,manager');
        Route::delete('/products/{id}', [ProductController::class, 'franchiseDestroy'])->middleware('franchise.role:owner,manager');
        Route::put('/products/{id}', [ProductController::class, 'franchiseUpdate'])->middleware('franchise.role:owner,manager');
        // Franchise users can change branch availability/stock; product creation is branch-scoped.
        Route::patch('/products/{id}/toggle', [ProductController::class, 'franchiseToggleAvailability'])->middleware('franchise.role:owner,manager');
        Route::get('/orders', [FranchiseController::class, 'orders']);
        Route::get('/replacement-requests', [OrderReplacementController::class, 'indexFranchise']);
        Route::get('/replacement-requests/report', [OrderReplacementController::class, 'reportFranchise']);
        Route::patch('/replacement-requests/{id}', [OrderReplacementController::class, 'reviewFranchise']);
        Route::post('/orders/{orderId}/replace-onsite', [OrderReplacementController::class, 'replaceOnsiteFranchise']);
        Route::get('/orders/{id}', [FranchiseController::class, 'showOrder']);
        Route::post('/pos/orders', [FranchiseController::class, 'storePosOrder']);
        Route::get('/pos/orders', [FranchiseController::class, 'franchisePosOrders']);
        Route::post('/pos/payments/gcash', [FranchiseController::class, 'createPosPayment']);
    });

});

Route::post('/employee/login', [EmployeeAuthController::class, 'login']);
Route::post('/employee/logout', [EmployeeAuthController::class, 'logout']);
Route::middleware(['employee.access:cashier'])->group(function () {
    Route::get('/employee/pos/promos', [PromoController::class, 'employeeIndex']);
    Route::post('/employee/pos/promos/validate', [PromoController::class, 'validateEmployeePromo'])->middleware('throttle:30,1,promo-validation');
    Route::get('/employee/pos/products', [FranchiseController::class, 'employeePosProducts']);
    Route::get('/employee/pos/orders', [FranchiseController::class, 'employeePosOrders']);
    Route::get('/employee/pos/top-products', [FranchiseController::class, 'employeePosTopProducts']);
    Route::get('/employee/pos/draft', [FranchiseController::class, 'employeePosDraft']);
    Route::put('/employee/pos/draft', [FranchiseController::class, 'saveEmployeePosDraft']);
    Route::get('/employee/pos/addon-groups', [AddonController::class, 'index']);
    Route::post('/employee/pos/orders', [FranchiseController::class, 'storePosOrder']);
    Route::post('/employee/pos/orders/{orderId}/replace-onsite', [OrderReplacementController::class, 'replaceOnsiteEmployee']);
    Route::post('/employee/pos/payments/gcash', [FranchiseController::class, 'createPosPayment']);
    Route::get('/cashier/popular-meals', [PopularMealsController::class, 'getMostPopularThisMonth']);
});
Route::middleware(['admin.access'])->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders/{orderId}/replace-onsite', [OrderReplacementController::class, 'replaceOnsiteAdmin']);
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
Route::post('/customer/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/customer/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');
Route::post('/customer/password-reset/verify', [CustomerPasswordRecoveryController::class, 'verify'])->middleware('throttle:20,1');
Route::post('/customer/password-reset/complete', [CustomerPasswordRecoveryController::class, 'complete'])->middleware('throttle:20,1');
Route::post('/verification/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:6,1');

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/available', [ProductController::class, 'getAvailable']);
Route::get('/products/category/{category}', [ProductController::class, 'getByCategory']);
Route::get('/products/{id}/image', [ProductController::class, 'image']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/addon-groups', [AddonController::class, 'index']);

Route::patch('/orders/{id}/status-update', [OrderController::class, 'updateStatusOnsite']);


/// KITCHEN
Route::middleware(['employee.access:kitchen_staff'])->group(function () {
    Route::get('/kitchen/orders', [KitchenOrderController::class, 'index']);
    Route::get('/kitchen/orders/counts', [KitchenOrderController::class, 'counts']);
    Route::patch('/kitchen/orders/{id}/status', [KitchenOrderController::class, 'updateStatus']);
    Route::patch('/kitchen/orders/{id}/schedule', [KitchenOrderController::class, 'reschedule']);
});

//drivers
Route::get('/driver/orders/counts', [DriverOrderController::class, 'counts']);
Route::get('/driver/orders', [DriverOrderController::class, 'index']);
Route::patch('/driver/orders/{id}/status', [DriverOrderController::class, 'updateStatus']);
Route::post('/driver/orders/{id}/delivery-proof', [DeliveryProofController::class, 'store']);
Route::get('/orders/{id}/delivery-proof', [ProofImageController::class, 'delivery']);
Route::get('/orders/{id}/discount-proof', [ProofImageController::class, 'orderDiscount']);
Route::get('/discount-applications/{id}/proof-image', [ProofImageController::class, 'discountApplication']);
Route::get('/discount-verifications/{id}/proof-image', [ProofImageController::class, 'discountVerification']);


Route::get('/payment/order/{reference}', [PaymentController::class, 'getOrderByReference']);
Route::post('/payment/confirm/{reference}', [PaymentController::class, 'confirmPaymentFromMobile']);
Route::post('/payment/gcash/webhook', [PaymentController::class, 'webhook']);
Route::get('/payment/status/{reference}', [PaymentController::class, 'getPaymentStatus']);
Route::post('/payment/gcash/create', [PaymentController::class, 'createGCashPayment'])->middleware('throttle:10,1');

Route::middleware(['auth:api', 'verified-user'])->group(function () {
    Route::get('/customer/announcements', [AnnouncementController::class, 'customerList']);
    Route::post('/customer/announcements/read-all', [AnnouncementController::class, 'markCustomerAnnouncementsRead']);
    Route::post('/customer/announcements/{id}/read', [AnnouncementController::class, 'setCustomerAnnouncementRead']);
    Route::get('/customer/replacement-notifications', [CustomerNotificationController::class, 'replacementUpdates']);
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
    Route::post('/orders/{orderId}/replacement-requests', [OrderReplacementController::class, 'storeCustomerRequest']);
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
    Route::get('/replacement-requests', [OrderReplacementController::class, 'indexAdmin']);
    Route::get('/replacement-requests/report', [OrderReplacementController::class, 'reportAdmin']);
    Route::patch('/replacement-requests/{id}', [OrderReplacementController::class, 'reviewAdmin']);
    Route::get('/inventory/suppliers', [MainBranchInventoryController::class, 'suppliers']);
    Route::post('/inventory/suppliers', [MainBranchInventoryController::class, 'storeSupplier']);
    Route::put('/inventory/suppliers/{supplier}', [MainBranchInventoryController::class, 'updateSupplier']);
    Route::delete('/inventory/suppliers/{supplier}', [MainBranchInventoryController::class, 'deleteSupplier']);
    Route::get('/inventory/export', [MainBranchInventoryController::class, 'export']);
    Route::post('/inventory/import', [MainBranchInventoryController::class, 'import']);
    Route::get('/inventory/recipes', [MainBranchInventoryController::class, 'recipes']);
    Route::get('/inventory/reports', [MainBranchInventoryController::class, 'reports']);
    Route::get('/inventory/restock-requests', [MainBranchInventoryController::class, 'restockRequests']);
    Route::post('/inventory/transfers', [MainBranchInventoryController::class, 'createTransfer']);
    Route::patch('/inventory/restock-requests/{restockRequest}/reject', [MainBranchInventoryController::class, 'rejectRestockRequest']);
    Route::get('/inventory/summary', [MainBranchInventoryController::class, 'summary']);
    Route::get('/inventory/movements', [MainBranchInventoryController::class, 'movements']);
    Route::post('/inventory/{ingredient}/receive', [MainBranchInventoryController::class, 'receive']);
    Route::post('/inventory/{ingredient}/count', [MainBranchInventoryController::class, 'countStock']);
    Route::put('/inventory/products/{product}/recipes', [MainBranchInventoryController::class, 'saveRecipes']);
    Route::get('/inventory/{ingredient}/movements', [MainBranchInventoryController::class, 'ingredientMovements']);
    Route::post('/inventory/{ingredient}/adjustments', [MainBranchInventoryController::class, 'adjust']);
    Route::patch('/inventory/{ingredient}/archive', [MainBranchInventoryController::class, 'archive']);
    Route::get('/inventory', [MainBranchInventoryController::class, 'index']);
    Route::post('/inventory', [MainBranchInventoryController::class, 'store']);
    Route::put('/inventory/{ingredient}', [MainBranchInventoryController::class, 'update']);

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
    Route::get('/promos/{id}/image', [PromoController::class, 'image']);
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
    Route::get('/products/archived', [ProductController::class, 'getArchivedForAdmin']);
    Route::get('/products/count', [ProductController::class, 'count']);
    Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);
    Route::patch('/products/{id}/archive', [ProductController::class, 'archive']);
    Route::patch('/products/{id}/restore', [ProductController::class, 'restore']);

    Route::get('/count', [AdminController::class, 'count']);
    Route::get('/discount-verifications', [DiscountVerificationController::class, 'index']);
    Route::patch('/discount-verifications/{id}', [DiscountVerificationController::class, 'updateStatus']);
    Route::get('/discount-applications', [DiscountApplicationController::class, 'index']);
    Route::patch('/discount-applications/{id}', [DiscountApplicationController::class, 'updateStatus']);
    Route::get('/target-profit-sales', [TargetProfitSaleController::class, 'show']);
    Route::put('/target-profit-sales', [TargetProfitSaleController::class, 'update']);
    Route::delete('/target-profit-sales', [TargetProfitSaleController::class, 'destroy']);

    Route::get('/company-branch-managers', [FranchiseController::class, 'availableCompanyBranchManagers']);
    Route::post('/company-branches', [FranchiseController::class, 'storeCompanyBranch']);
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
    Route::get('/franchise-accounts/{id}/report', [FranchiseAccountController::class, 'report']);
    Route::get('/franchise-accounts/{id}/detailed-report', [FranchiseAccountController::class, 'detailedReport']);
    Route::put('/franchise-accounts/{id}', [FranchiseAccountController::class, 'update']);
    Route::delete('/franchise-accounts/{id}', [FranchiseAccountController::class, 'destroy']);
    Route::post('/franchise-accounts/{id}/locations', [FranchiseAccountController::class, 'storeLocation']);
    Route::post('/franchise-accounts/{id}/managers', [FranchiseAccountController::class, 'storeManager']);

    Route::delete('/customers/{id}', [AdminController::class, 'destroyCustomer']);
    Route::get('/me', [AdminController::class, 'showCurrent']);
    Route::middleware('system.administrator')->group(function () {
        Route::get('/list', [AdminController::class, 'index']);
        Route::post('/register', [AdminController::class, 'store']);
        Route::put('/admins/{id}', [AdminController::class, 'update']);
        Route::patch('/admins/{id}/role', [AdminController::class, 'updateRole']);
        Route::put('/admins/{id}/reset-password', [AdminController::class, 'resetPassword']);
        Route::delete('/admins/{id}', [AdminController::class, 'destroy']);
    });
});

Route::prefix('admin')->group(function () {
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
});

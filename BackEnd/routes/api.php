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
use Illuminate\Http\Request;

Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::get('/settings/pricing', [SettingController::class, 'index']);

Route::get('/employees', [EmployeeController::class, 'index']);
Route::post('/employees', [EmployeeController::class, 'store']);
Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
Route::put('/employees/{id}/reset-password', [EmployeeController::class, 'resetPassword']);
Route::post('/employee/login', [EmployeeAuthController::class, 'login']);

Route::get('/drivers', [DriverController::class, 'index']);
Route::get('/drivers/{id}', [DriverController::class, 'show']);
Route::post('/drivers', [DriverController::class, 'store']);
Route::put('/drivers/{id}', [DriverController::class, 'update']);
Route::delete('/drivers/{id}', [DriverController::class, 'destroy']);
Route::put('/drivers/{id}/reset-password', [DriverController::class, 'resetPassword']);
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

Route::get('/orders', [OrderController::class, 'index']);
Route::get('/orders/customers', [OrderController::class, 'getAllCustomers']);
Route::middleware(['auth:api', 'verified-user'])->get('/orders/user', [OrderController::class, 'getUserOrders']);
Route::get('/orders/{id}', [OrderController::class, 'show']);
Route::get('/settings/pricing', [SettingController::class, 'index']);

Route::get('/payment/order/{reference}', [PaymentController::class, 'getOrderByReference']);
Route::post('/payment/confirm/{reference}', [PaymentController::class, 'confirmPaymentFromMobile']);
Route::post('/payment/gcash/create', [PaymentController::class, 'createGCashPayment']);
Route::post('/payment/gcash/webhook', [PaymentController::class, 'webhook']);
Route::get('/payment/status/{reference}', [PaymentController::class, 'getPaymentStatus']);

Route::middleware(['auth:api', 'verified-user'])->group(function () {
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

    Route::post('/payment/gcash/request-otp', [PaymentController::class, 'requestGCashOTP']);
    Route::post('/payment/gcash/verify', [PaymentController::class, 'verifyGCash']);
    Route::post('/payment/card/process', [PaymentController::class, 'processCard']);
    Route::get('/payment/history', [PaymentController::class, 'getPaymentHistory']);

});

Route::prefix('admin')->group(function () {
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

    Route::post('/register', [AdminController::class, 'store']);
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::delete('/customers/{id}', [AdminController::class, 'destroyCustomer']);
    Route::get('/list', [AdminController::class, 'index']);
    Route::get('/count', [AdminController::class, 'count']);
    Route::get('/target-profit-sales', [TargetProfitSaleController::class, 'show']);
    Route::put('/target-profit-sales', [TargetProfitSaleController::class, 'update']);
    Route::delete('/target-profit-sales', [TargetProfitSaleController::class, 'destroy']);
});
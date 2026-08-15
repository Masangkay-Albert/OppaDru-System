<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminAuthController;

Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});

// Auth Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Public Product Routes
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/available', [ProductController::class, 'getAvailable']);
Route::get('/products/category/{category}', [ProductController::class, 'getByCategory']);
Route::get('/products/{id}', [ProductController::class, 'show']);

// Public Order Routes (for customers to view orders)
Route::get('/orders', [OrderController::class, 'index']);
Route::get('/orders/customers', [OrderController::class, 'getAllCustomers']);
Route::get('/orders/{id}', [OrderController::class, 'show']);

// Protected Routes (require authentication)
Route::middleware('auth:api')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Product Management
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);

    // Order Management
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/user', [OrderController::class, 'getUserOrders']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    // Payment Routes
    Route::post('/payment/gcash/request-otp', [PaymentController::class, 'requestGCashOTP']);
    Route::post('/payment/gcash/verify', [PaymentController::class, 'verifyGCash']);
    Route::post('/payment/card/process', [PaymentController::class, 'processCard']);
    Route::get('/payment/history', [PaymentController::class, 'getPaymentHistory']);
});

// Admin Routes (no auth middleware - uses internal checkAdminAuth)
Route::prefix('admin')->group(function () {
    // Product Management
    Route::get('/products', [ProductController::class, 'getAllForAdmin']);
    Route::get('/products/count', [ProductController::class, 'count']);
    Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);
    
    // Admin Management
    Route::post('/register', [AdminController::class, 'store']);
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::get('/list', [AdminController::class, 'index']);
    Route::get('/count', [AdminController::class, 'count']);
});
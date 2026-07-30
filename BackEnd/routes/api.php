<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;

Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/available', [ProductController::class, 'getAvailable']);
Route::get('/products/category/{category}', [ProductController::class, 'getByCategory']);
Route::get('/products/{id}', [ProductController::class, 'show']);

Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::patch('/products/{id}/toggle', [ProductController::class, 'toggleAvailability']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/user', [OrderController::class, 'getUserOrders']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    Route::post('/payment/gcash/request-otp', [PaymentController::class, 'requestGCashOTP']);
    Route::post('/payment/gcash/verify', [PaymentController::class, 'verifyGCash']);
    Route::post('/payment/card/process', [PaymentController::class, 'processCard']);
    Route::get('/payment/history', [PaymentController::class, 'getPaymentHistory']);
});
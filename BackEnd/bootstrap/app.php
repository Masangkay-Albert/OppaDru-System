<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->append(\App\Http\Middleware\CorsMiddleware::class);
        $middleware->alias([
            'verified-user' => \App\Http\Middleware\EnsureUserIsVerified::class,
            'franchise.applicant.access' => \App\Http\Middleware\EnsureFranchiseApplicantAccess::class,
            'franchise.access' => \App\Http\Middleware\EnsureFranchiseAccess::class,
            'employee.access' => \App\Http\Middleware\EnsureEmployeeAccess::class,
            'admin.access' => \App\Http\Middleware\EnsureAdminAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, \Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();

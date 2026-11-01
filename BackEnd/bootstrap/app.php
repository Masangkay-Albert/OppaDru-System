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
    ->withCommands()
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->append(\App\Http\Middleware\CorsMiddleware::class);
        $middleware->alias([
            'verified-user' => \App\Http\Middleware\EnsureUserIsVerified::class,
            'franchise.applicant.access' => \App\Http\Middleware\EnsureFranchiseApplicantAccess::class,
            'franchise.access' => \App\Http\Middleware\EnsureFranchiseAccess::class,
            'franchise.role' => \App\Http\Middleware\EnsureFranchiseRole::class,
            'employee.access' => \App\Http\Middleware\EnsureEmployeeAccess::class,
            'admin.access' => \App\Http\Middleware\EnsureAdminAccess::class,
            'system.administrator' => \App\Http\Middleware\RequireSystemAdministrator::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, \Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );
        $exceptions->render(function (\Throwable $exception, Request $request) {
            if (! $request->is('api/employee/pos/*')) {
                return null;
            }

            \Illuminate\Support\Facades\Log::error('Employee POS request failed.', [
                'path' => $request->path(),
                'exception' => $exception,
            ]);

            $status = $exception instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                ? $exception->getStatusCode()
                : 500;
            $message = $status >= 500
                ? 'Unable to complete the POS request. Please try again.'
                : $exception->getMessage();

            return response()->json([
                'success' => false,
                'message' => $message,
            ], $status);
        });
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Method not allowed.'], 405);
            }

            return null;
        });
    })->create();

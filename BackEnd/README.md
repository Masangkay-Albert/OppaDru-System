<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [queue](https://laravel.com/docs/queues) and notification APIs.
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).


Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Production email verification

Verification uses Laravel's synchronous notification mail channel. It must use a real SMTP provider in Render; the application does not log or simulate verification links.

Set these Render environment variables:

```text
APP_URL=https://oppadru-system-1.onrender.com
FRONTEND_URL=https://oppa-dru-system.vercel.app
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SCHEME=smtp
MAIL_USERNAME=the-provider-account@example.com
MAIL_PASSWORD=the-provider-app-password
MAIL_FROM_ADDRESS=the-provider-account@example.com
MAIL_FROM_NAME=OPPA DRU
MAIL_TIMEOUT=10
QUEUE_CONNECTION=sync
```

The SMTP account must have permission to send mail and should use an app password or provider SMTP credential, not a normal mailbox password. `QUEUE_CONNECTION=sync` means a separate Render worker is not required. If the queue is changed to `database`, run a Render worker with `php artisan queue:work`; otherwise notifications will remain queued and no email will be sent.

Registration returns an error instead of claiming success when SMTP rejects the message. The signed verification URL expires after 60 minutes, is validated by Laravel, marks `email_verified_at`, and redirects to the frontend login page.

## Franchise ordering and POS

- Customers choose an active branch in the customer menu; the original store remains the default.
- Public branch listings are served by `GET /api/franchises/active`.
- Branch menus use `GET /api/products/available?franchise_id={branch-id}` and return shared products plus products belonging to that active branch.
- Customer checkout includes the selected `franchise_id` on the order.
- Franchise managers use `/franchise/pos` for onsite POS orders and `/franchise/orders` to review and update their branch's online and onsite order statuses.
- POS orders are created through authenticated `POST /api/franchise/pos/orders`; the server validates branch ownership and calculates line prices and discounts.
- The franchise dashboard, inventory, reports, users, and settings pages are available from the portal navigation. Their API endpoints are scoped to the authenticated manager's branch.
- Branch stock and availability are stored separately from the shared product catalog in `franchise_inventory`. Stock is decremented transactionally for branch POS and customer orders, and a branch manager can start stock tracking from the Inventory page.
- Franchise POS supports the configured product add-ons and drink sizes. The API rechecks branch ownership and computes option prices from server-side product/add-on data.
- POS GCash orders create a gateway payment for the server-calculated order total, then require a confirmed, unused payment record assigned to that branch before finalizing the order. Cash is supported directly. Card is intentionally unavailable in franchise POS until a secure gateway card flow is implemented.
- Run the additive `franchise_inventory` migration during deployment. It does not seed, reset, or modify existing product/order data; foreign keys prevent deleting referenced branch or product rows.
- The branch users page displays that branch's franchise managers and assigned employees. A manager can add another manager using `POST /api/franchise/users`; the new account is always assigned to the authenticated branch and has the same full portal permissions. Cashier/staff account creation remains unavailable until the employee login and POS workflows enforce branch isolation.
- Franchise managers can update only their branch phone and operating hours with `PUT /api/franchise/settings`. HQ retains control of the official branch name, email, address, and active status.

To test real delivery from the Render Shell without exposing a public diagnostic endpoint, run:

```bash
php artisan mail:test your-real-test-address@example.com
```

This command uses the same mail configuration as registration. If it fails, copy the exception from the Render logs; it will identify the provider, credential, TLS, DNS, or connection problem.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

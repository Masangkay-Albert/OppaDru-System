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

### Improve inbox placement

The application trusts the forwarding headers from its Render reverse proxy so verification links use the public HTTPS host instead of an internal HTTP connection. Keep `APP_URL` set to the canonical public HTTPS backend URL, and redeploy after changing Render environment variables.

Inbox placement cannot be guaranteed by application code alone. Configure the sending domain with the mail provider and publish the exact DNS records the provider supplies:

- SPF must authorize the provider that sends these messages. Keep one SPF record for the domain and merge providers into it rather than publishing multiple SPF records.
- Enable DKIM signing with the provider and publish its DKIM records.
- Publish a DMARC record for the visible `MAIL_FROM_ADDRESS` domain. Start with `p=none` while monitoring reports, then move to a stricter policy once all legitimate senders pass.
- Use a sender address on a domain you control and align it with the authenticated sending domain. For a custom domain, use a transactional email provider or a properly configured Google Workspace sender; a personal `@gmail.com` address is not a branded sender identity.

After DNS changes, verify SPF, DKIM, and DMARC pass on a received message's headers and check the provider's delivery/reputation dashboard. Gmail may still classify messages based on recipient-specific history and sender reputation.

## Franchise ordering and POS

- Admins can schedule a franchise interview online with a meeting link or onsite with a location that is shown to the applicant. Internal interview notes remain admin-only. Run `php artisan migrate --force` during deployment to add interview type and location fields.
- After a successful interview, the franchisor moves the application to `Location Assessment`. Steps 4–6 are presented as one combined applicant stage for site inspection, financial/final evaluation, and the agreement. The admin should configure the complete document checklist and, if needed, request every document together using `Additional Information Required`; the applicant submits one combined response, which returns the application to `Location Assessment` for review. The admin can then record the final decision/agreement or place the application on hold or reject it.
- Franchise management uses `franchise_accounts` as the parent business record and keeps the existing `franchises` table as its branch/location records. The additive `2026_10_08_000001_create_franchise_accounts_and_link_locations` migration links existing branches and branch managers to a generated account without changing their existing IDs.
- HQ manages franchise account details, activation, locations, managers, staff, and revenue performance through the admin franchise module. A franchise manager can view their associated account and locations; order/POS/inventory operations remain scoped to their assigned location. Deactivating an account blocks customer ordering and branch manager, employee, and driver operational access at its locations.
- Customers choose an active branch in the customer menu; the original store remains the default.
- Public branch listings are served by `GET /api/franchises/active`.
- Branch menus use `GET /api/products/available?franchise_id={branch-id}` and return shared products plus products belonging to that active branch.
- Customer checkout includes the selected `franchise_id` on the order.
- Existing `orders.franchise_id` and `products.franchise_id` identify the selected location without duplicating customer, product, order, or payment records. Orders without a selected location remain main-restaurant orders; location revenue is calculated from the same order table using branch scope.
- Customer GCash/card payment creation receives the selected location, validates products and add-ons against that branch's active catalog, and stores the location in existing payment metadata. Order placement rechecks that location and atomically links a confirmed payment to its single order through `payments.order_id`.
- Branch stock remains in the existing `franchise_inventory` table, keyed by location and product. The same stock availability is checked for customer checkout and POS, and branch stock is consumed transactionally when an order is created. Main-store orders keep using the shared catalog and do not touch franchise inventory.
- Franchise managers with POS permission use `/franchise/pos` for onsite sales. All managers can review location-scoped sales totals and paginated POS activity at `/franchise/pos/activity`; `/franchise/orders` remains the workflow for online and onsite order status updates.
- Franchise POS and branch cashiers use the existing orders and payments: each sale records its location, order timestamp, payment method/status/reference, and cashier or authorized manager. Manager POS transactions use the additive `orders.franchise_user_id` relationship; cashier transactions use the existing `orders.cashier_employee_id`. Gateway payments remain linked through `payments.order_id`.
- POS orders are created through authenticated `POST /api/franchise/pos/orders`; the server validates branch ownership and calculates line prices and discounts. `GET /api/franchise/pos/orders` returns only the authenticated manager's location activity. Cashiers see only their own transactions through `GET /api/employee/pos/orders`.
- The franchise dashboard, inventory, reports, users, and settings pages are available from the portal navigation. Their API endpoints are scoped to the authenticated manager's branch.
- Branch stock and availability are stored separately from the shared product catalog in `franchise_inventory`. Stock is decremented transactionally for branch POS and customer orders, and a branch manager can start stock tracking from the Inventory page.
- Franchise POS supports the configured product add-ons and drink sizes. The API rechecks branch ownership and computes option prices from server-side product/add-on data.
- POS GCash orders create a gateway payment for the server-calculated order total, then require a confirmed, unused payment record assigned to the same location and initiating cashier/manager before finalizing the order. Cash and card-terminal payments are supported directly.
- Run the additive `franchise_inventory` migration during deployment. It does not seed, reset, or modify existing product/order data; foreign keys prevent deleting referenced branch or product rows.
- The branch users page displays that branch's franchise managers and assigned employees. Cashier and staff employee accounts remain location-scoped through the existing employee login and POS authorization.
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

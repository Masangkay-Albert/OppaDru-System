<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Product;
use App\Models\Order;

$user = User::firstOrCreate([
    'email' => 'debug@example.com',
], [
    'full_name' => 'Debug',
    'phone' => '09123456789',
    'password' => bcrypt('pass'),
    'role' => 'customer',
    'email_verified_at' => now(),
]);

$product = Product::firstOrCreate([
    'name' => 'Debug Item',
], [
    'description' => 'x',
    'price' => 100,
    'category' => 'chicken',
    'image' => 'x.jpg',
    'is_available' => true,
]);

$order = Order::create([
    'email' => $user->email,
    'user_id' => $user->id,
    'total' => 100,
    'delivery_fee' => 49,
    'service_fee' => 15,
    'status' => 'pending',
    'payment_method' => 'cash_on_delivery',
    'delivery_address' => 'addr',
    'phone' => '09123456789',
    'items' => [['product_id' => $product->id, 'product_name' => $product->name, 'product_price' => 100, 'quantity' => 1]],
    'payment_status' => 'pending',
]);

echo "created=" . $order->created_at . PHP_EOL;
Order::whereKey($order->id)->update(['created_at' => now()->subSeconds(21)]);
$refresh = Order::find($order->id);
echo "updated=" . $refresh->created_at . PHP_EOL;
echo "diff=" . now()->diffInSeconds($refresh->created_at) . PHP_EOL;

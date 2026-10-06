<?php

namespace App\Http\Controllers;

use App\Models\DiscountApplication;
use App\Models\DiscountVerificationRequest;
use App\Models\Order;
use App\Support\DatabaseImage;
use Illuminate\Support\Facades\Storage;

class ProofImageController extends Controller
{
    public function delivery(string $id)
    {
        $order = Order::findOrFail($id);
        $imageData = $order->getRawOriginal('delivery_proof_image_data');
        if ($imageData) {
            return DatabaseImage::response($imageData);
        }

        return $this->legacyImage($order->getRawOriginal('delivery_proof_image'));
    }

    public function orderDiscount(string $id)
    {
        $order = Order::findOrFail($id);
        $imageData = $order->getRawOriginal('discount_proof_image_data');
        if ($imageData) {
            return DatabaseImage::response($imageData);
        }

        return $this->legacyImage($order->getRawOriginal('discount_proof_image'));
    }

    public function discountApplication(string $id)
    {
        $application = DiscountApplication::findOrFail($id);
        $imageData = $application->getRawOriginal('proof_image_data');
        if ($imageData) {
            return DatabaseImage::response($imageData);
        }

        return $this->legacyImage($application->getRawOriginal('proof_image_url'));
    }

    public function discountVerification(string $id)
    {
        $request = DiscountVerificationRequest::findOrFail($id);
        $imageData = $request->getRawOriginal('proof_image_data');
        if ($imageData) {
            return DatabaseImage::response($imageData);
        }

        return $this->legacyImage($request->getRawOriginal('proof_image_url'));
    }

    private function legacyImage(?string $storedImage)
    {
        if (! $storedImage) {
            abort(404, 'Proof image not found.');
        }

        if (preg_match('/\Ahttps?:\/\//i', $storedImage)) {
            $path = parse_url($storedImage, PHP_URL_PATH);
            $storagePrefix = '/storage/';
            $storagePosition = is_string($path) ? strpos($path, $storagePrefix) : false;
            if ($storagePosition !== false) {
                $storedImage = substr($path, $storagePosition + strlen($storagePrefix));
            } else {
                return redirect()->away($storedImage);
            }
        }

        $disk = Storage::disk('public');
        if ($disk->exists($storedImage)) {
            return response($disk->get($storedImage), 200, [
                'Content-Type' => $disk->mimeType($storedImage) ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        abort(404, 'Proof image not found.');
    }
}

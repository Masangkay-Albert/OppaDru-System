@component('mail::message')
# Discount Request Update

Hello {{ $customerName }},

Your {{ $discountType }} discount request has been {{ $status }}.

@if($status === 'approved')
Your request has been accepted and the discount will be applied to eligible orders.
@else
Your request was not approved for the following reason:

> {{ $rejectionReason ?? 'No reason provided.' }}
@endif

Thank you for using Oppa Dru.

@component('mail::button', ['url' => config('app.url', 'https://oppadru-system-1.onrender.com')])
Visit Oppa Dru
@endcomponent
@endcomponent

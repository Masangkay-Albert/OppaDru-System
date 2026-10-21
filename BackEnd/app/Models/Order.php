<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_id',
        'franchise_account_id',
        'branch_id',
        'created_at',
        'updated_at',
        'email',
        'user_id',
        'driver_id',
        'cashier_employee_id',
        'franchise_user_id',
        'include_cutlery',
        'order_number',
        'total',
        'delivery_fee',
        'delivery_distance_km',
        'distance_km',
        'delivery_calculation_method',
        'delivery_type',
        'delivery_address',
        'delivery_coordinates',
        'delivery_lat',
        'delivery_lng',
        'delivery_proof_image',
        'delivery_proof_image_data',
        'delivery_proof_uploaded_at',
        'delivery_confirmed_at',
        'service_fee',
        'priority_fee',
        'vat',
        'service_fee_rule',
        'status',
        'status_history',
        'payment_method',
        'phone',
        'items',
        'scheduled_at',
        'scheduled_date',
        'scheduled_time',
        'schedule_display',
        'schedule_window',
        'is_scheduled',
        'scheduled_for',
        'fulfillment_type',
        'special_instructions',
        'rescheduled_from',
        'payment_reference',
        'payment_status',
        'discount_type',
        'discount_rate',
        'discount_amount',
        'discount_status',
        'discount_proof_image',
        'discount_proof_image_data',
        'discount_rejection_reason',
        'discount_requested_at',
        'discount_reviewed_at',
        'promo_id',
        'promo_code',
        'promo_discount',
    ];

    protected $casts = [
        'total' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'delivery_distance_km' => 'decimal:3',
        'distance_km' => 'decimal:3',
        'promo_discount' => 'decimal:2',
        'delivery_lat' => 'decimal:7',
        'delivery_lng' => 'decimal:7',
        'delivery_type' => 'string',
        'delivery_coordinates' => 'array',
        'delivery_proof_uploaded_at' => 'datetime',
        'delivery_confirmed_at' => 'datetime',
        'service_fee' => 'decimal:2',
        'priority_fee' => 'decimal:2',
        'vat' => 'decimal:2',
        'items' => 'array',
        'status_history' => 'array',
        'include_cutlery' => 'boolean',
        'scheduled_at' => 'datetime',
        'is_scheduled' => 'boolean',
        'scheduled_for' => 'datetime',
        'rescheduled_from' => 'datetime',
        'discount_rate' => 'decimal:4',
        'discount_amount' => 'decimal:2',
        'discount_requested_at' => 'datetime',
        'discount_reviewed_at' => 'datetime',
    ];

    protected $hidden = [
        'delivery_proof_image_data',
        'discount_proof_image_data',
    ];

    public function getDeliveryProofImageAttribute($value): ?string
    {
        return $value || !empty($this->attributes['delivery_proof_image_data'])
            ? url('/api/orders/'.$this->id.'/delivery-proof')
            : null;
    }

    public function getDiscountProofImageAttribute($value): ?string
    {
        if (!empty($this->attributes['discount_proof_image_data'])) {
            return url('/api/orders/'.$this->id.'/discount-proof');
        }

        if ($value && (str_starts_with($value, 'data:image/') || preg_match('/\.(jpe?g|png|gif|webp)(?:[?#].*)?\z/i', $value))) {
            return url('/api/orders/'.$this->id.'/discount-proof');
        }

        return $value;
    }

    protected static function boot()
    {
        parent::boot();
        static::saving(function (self $order) {
            if (
                strtolower((string) $order->payment_method) === 'cash_on_delivery'
                && strtolower((string) $order->status) === 'delivered'
                && in_array(strtolower((string) ($order->payment_status ?? 'pending')), ['pending', 'unpaid'], true)
            ) {
                $order->payment_status = 'paid';
            }
        });
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'OPPA-ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            }
            if (empty($model->order_number)) {
                $model->order_number = 'OPPA-ORD-' . date('Ymd') . '-' . strtoupper(Str::random(8));
            }
            if (empty($model->status_history) && ! empty($model->status)) {
                $model->status_history = [[
                    'status' => (string) $model->status,
                    'created_at' => now()->toIso8601String(),
                ]];
            }
        });
        static::updating(function (self $model) {
            if (! $model->isDirty('status')) {
                return;
            }

            $history = is_array($model->status_history) ? $model->status_history : [];
            $previousStatus = (string) $model->getOriginal('status');
            $nextStatus = (string) $model->status;
            if ($previousStatus !== '' && ! $history) {
                $history[] = [
                    'status' => $previousStatus,
                    'created_at' => $model->created_at?->toIso8601String(),
                ];
            }
            if ($nextStatus !== '' && ($history[count($history) - 1]['status'] ?? null) !== $nextStatus) {
                $history[] = [
                    'status' => $nextStatus,
                    'created_at' => now()->toIso8601String(),
                ];
            }
            $model->status_history = $history;
        });
    }

    public function scopeCountedAsRevenue(Builder $query): Builder
    {
        return $query
            ->whereNotIn('status', ['cancelled', 'failed'])
            ->where(function (Builder $paymentQuery) {
                $paymentQuery
                    ->where('payment_status', 'paid')
                    ->orWhere(function (Builder $codQuery) {
                        $codQuery
                            ->where('payment_method', 'cash_on_delivery')
                            ->where('status', 'delivered')
                            ->where(function (Builder $pendingQuery) {
                                $pendingQuery
                                    ->whereNull('payment_status')
                                    ->orWhereIn('payment_status', ['pending', 'unpaid']);
                            });
                    });
            });
    }

    public function isCountedAsRevenue(): bool
    {
        $status = strtolower((string) $this->status);
        $paymentStatus = strtolower((string) ($this->payment_status ?? 'pending'));

        if (in_array($status, ['cancelled', 'failed'], true) || in_array($paymentStatus, ['failed', 'cancelled', 'expired'], true)) {
            return false;
        }

        return $paymentStatus === 'paid'
            || (
                strtolower((string) $this->payment_method) === 'cash_on_delivery'
                && $status === 'delivered'
                && in_array($paymentStatus, ['pending', 'unpaid'], true)
            );
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function franchise()
    {
        return $this->belongsTo(Franchise::class, 'franchise_id', 'id');
    }

    public function branch()
    {
        return $this->belongsTo(Franchise::class, 'branch_id', 'id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id', 'id');
    }

    public function cashier()
    {
        return $this->belongsTo(Employee::class, 'cashier_employee_id', 'id');
    }

    public function franchiseOperator()
    {
        return $this->belongsTo(FranchiseUser::class, 'franchise_user_id', 'id');
    }

    public function payment()
    {
        return $this->hasOne(Payment::class, 'order_id', 'id');
    }

    public function discountVerificationRequest()
    {
        return $this->hasOne(DiscountVerificationRequest::class, 'order_id', 'id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'order_id', 'id')->with('addons');
    }
}

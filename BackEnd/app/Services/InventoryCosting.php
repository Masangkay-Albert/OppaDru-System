<?php

namespace App\Services;

use InvalidArgumentException;

final class InventoryCosting
{
    public static function isValidTotalPrice(mixed $value): bool
    {
        if (! is_string($value) && ! is_int($value) && ! is_float($value)) {
            return false;
        }

        $value = (string) $value;
        $max = (string) config('inventory.max_total_price_paid', '9999999.99');

        return preg_match('/^\d+(?:\.\d{1,2})?$/', $value) === 1
            && bccomp($value, $max, 2) <= 0;
    }

    public static function normalizeMoney(string|int|float $value): string
    {
        if (! self::isValidTotalPrice($value)) {
            throw new InvalidArgumentException('Total price must be a non-negative amount with up to two decimals.');
        }

        return bcadd((string) $value, '0', 2);
    }

    public static function roundMoney(string $value): string
    {
        $negative = str_starts_with($value, '-');
        $absolute = $negative ? substr($value, 1) : $value;
        [$whole, $fraction] = array_pad(explode('.', $absolute, 2), 2, '');
        $fraction = str_pad($fraction, 3, '0');
        $cents = (int) substr($fraction, 0, 2);

        if ((int) $fraction[2] >= 5) {
            $cents++;
        }

        if ($cents >= 100) {
            $whole = bcadd($whole, '1', 0);
            $cents = 0;
        }

        $result = $whole.'.'.str_pad((string) $cents, 2, '0', STR_PAD_LEFT);

        return $negative && $result !== '0.00' ? '-'.$result : $result;
    }

    public static function valueForQuantity(string $quantity, string $unitCost): string
    {
        return self::roundMoney(bcmul($quantity, $unitCost, 8));
    }

    public static function valueForProportionalQuantity(
        string $totalValue,
        string $quantity,
        string $totalQuantity,
    ): string {
        if (bccomp($totalQuantity, '0', 8) <= 0) {
            return '0.00';
        }

        return self::roundMoney(bcdiv(bcmul($totalValue, $quantity, 8), $totalQuantity, 8));
    }

    public static function unitCost(string $totalCost, string $quantity, int $scale = 4): string
    {
        if (bccomp($quantity, '0', 8) <= 0) {
            return '0';
        }

        return bcdiv($totalCost, $quantity, $scale);
    }

    public static function currentValue(?string $storedValue, string $quantity, ?string $unitCost): ?string
    {
        if ($storedValue !== null) {
            return self::roundMoney($storedValue);
        }

        if ($unitCost === null) {
            return null;
        }

        return self::valueForQuantity($quantity, $unitCost);
    }

    public static function valueAfterChange(
        ?string $currentValue,
        string $quantityBefore,
        string $quantityChange,
        ?string $unitCost,
        ?string $totalCost
    ): ?string {
        if ($quantityChange === '0') {
            return $currentValue;
        }

        if (bccomp($quantityChange, '0', 8) > 0) {
            if ($totalCost !== null) {
                return bcadd($currentValue ?? '0.00', self::roundMoney($totalCost), 2);
            }

            if ($unitCost === null) {
                return $currentValue;
            }

            return bcadd($currentValue ?? '0.00', self::valueForQuantity($quantityChange, $unitCost), 2);
        }

        if ($currentValue === null) {
            return null;
        }

        if (bccomp($quantityBefore, '0', 8) <= 0) {
            return '0.00';
        }

        $quantityOut = ltrim($quantityChange, '-');
        $valueOut = self::valueForProportionalQuantity($currentValue, $quantityOut, $quantityBefore);

        return bccomp($quantityBefore, $quantityOut, 8) <= 0
            ? '0.00'
            : bcsub($currentValue, $valueOut, 2);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeAuthSession extends Model
{
    protected $fillable = [
        'employee_id',
        'token_hash',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public static function employeeForToken(string $token): ?Employee
    {
        return static::query()
            ->with('employee.franchise')
            ->where('token_hash', hash('sha256', $token))
            ->first()
            ?->employee;
    }
}

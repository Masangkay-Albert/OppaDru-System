<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\FranchiseUser;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    // Fetch all drivers
    public function index()
    {
        return response()->json(Driver::select('id', 'name', 'email', 'phone', 'vehicleType', 'isActive')->get());
    }

    // Fetch a single driver by ID
    public function show($id)
    {
        $driver = Driver::findOrFail($id);
        return response()->json($driver);
    }

    // Create a new driver
    public function store(Request $request)
    {
        if ($request->exists('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        }
        $validated = $request->validate([
            'name'        => [
                'required',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'email'       => 'required|string|email|max:'.config('input_limits.email').'|unique:drivers,email',
            'password'    => ['required', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max')],
            'phone'       => ['required', 'string', 'max:13', 'regex:'.config('input_limits.phone')],
            'vehicleType' => 'required|string|max:30',
            'isActive'    => 'boolean',
        ]);

        $validated['email'] = strtolower(trim($validated['email']));
        if ($this->emailUsedByOtherStaff($validated['email'])) {
            return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
        }

        // Default isActive to true if not provided
        if (!isset($validated['isActive'])) {
            $validated['isActive'] = true;
        }

        // The password will be automatically hashed by the model's 'hashed' cast
        $driver = Driver::create($validated);

        return response()->json($driver, 201);
    }

    // Update driver details (like status or vehicle)
    public function update(Request $request, $id)
    {
        $driver = Driver::findOrFail($id);
        $unchanged = [];
        foreach (['name', 'email', 'phone', 'vehicleType'] as $field) {
            if (! $request->exists($field) || ! is_string($request->input($field))) {
                continue;
            }
            $submitted = trim($request->input($field));
            $stored = trim((string) $driver->{$field});
            $unchanged[$field] = $field === 'email'
                ? strcasecmp($submitted, $stored) === 0
                : $submitted === $stored;
        }
        if ($request->exists('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        }
        $nameRules = ['sometimes', 'required', 'string'];
        if ($request->exists('name') && ! ($unchanged['name'] ?? false)) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ];
        }
        $emailRules = ['sometimes', 'required', 'string', 'email', 'unique:drivers,email,'.$driver->id];
        if ($request->exists('email') && ! ($unchanged['email'] ?? false)) {
            $emailRules[] = 'max:'.config('input_limits.email');
        }
        $phoneRules = ['sometimes', 'required', 'string'];
        if ($request->exists('phone') && ! ($unchanged['phone'] ?? false)) {
            $phoneRules = [...$phoneRules, 'max:13', 'regex:'.config('input_limits.phone')];
        }
        $vehicleRules = ['sometimes', 'required', 'string'];
        if ($request->exists('vehicleType') && ! ($unchanged['vehicleType'] ?? false)) {
            $vehicleRules[] = 'max:30';
        }
        $validated = $request->validate([
            'name'        => $nameRules,
            'email'       => $emailRules,
            'phone'       => $phoneRules,
            'vehicleType' => $vehicleRules,
            'isActive'    => 'sometimes|boolean',
        ]);

        if (isset($validated['email']) && ! ($unchanged['email'] ?? false)) {
            $validated['email'] = strtolower(trim($validated['email']));
            if ($this->emailUsedByOtherStaff($validated['email'])) {
                return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
            }
        }
        foreach ($unchanged as $field => $isUnchanged) {
            if ($isUnchanged) {
                unset($validated[$field]);
            }
        }

        if (array_key_exists('isActive', $validated) && ! $validated['isActive']) {
            $driver->api_token = null;
        }
        $driver->update($validated);

        return response()->json($driver);
    }

    // Delete a driver
    public function destroy($id)
    {
        $driver = Driver::findOrFail($id);
        $driver->delete();

        return response()->json(['message' => 'Driver deleted successfully']);
    }

    // Reset a driver's password
    public function resetPassword(Request $request, $id)
    {
        $request->validate([
            'password' => ['required', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max')],
        ]);

        $driver = Driver::findOrFail($id);
        $driver->api_token = null;
        $driver->update([
            'password' => $request->password
        ]);
        
        return response()->json(['message' => 'Password reset successfully']);
    }

    private function emailUsedByOtherStaff(string $email): bool
    {
        return Employee::whereRaw('LOWER(email) = ?', [$email])->exists()
            || FranchiseUser::whereRaw('LOWER(email) = ?', [$email])->exists();
    }
}
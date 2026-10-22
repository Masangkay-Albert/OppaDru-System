<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    // Fetch all employees
    public function index()
    {
        return Employee::with(['franchise:id,name,franchise_account_id', 'franchise.franchiseAccount:id,name'])
            ->select('id', 'franchise_id', 'fullName', 'email', 'position', 'is_active', 'created_at')
            ->orderByDesc('created_at')
            ->get();
    }

    // Create a new employee
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fullName' => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:employees,email',
            'password' => 'required|string|min:6',
            'position' => 'required|in:cashier,kitchen staff,staff',
            'franchise_id' => 'nullable|string|exists:franchises,id',
        ]);

        $validated['email'] = strtolower(trim($validated['email']));
        if ($this->emailUsedByOtherStaff($validated['email'])) {
            return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
        }

        $employee = Employee::create($validated);

        return response()->json($employee->load(['franchise.franchiseAccount']), 201);
    }

    public function update(Request $request, string $id)
    {
        $employee = Employee::findOrFail($id);
        $validated = $request->validate([
            'fullName' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:employees,email,' . $employee->id . ',id',
            'position' => 'sometimes|required|in:cashier,kitchen staff,staff',
            'franchise_id' => 'missing',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['email'])) {
            $validated['email'] = strtolower(trim($validated['email']));
            if ($this->emailUsedByOtherStaff($validated['email'])) {
                return response()->json(['message' => 'This email address is already assigned to another staff account.'], 422);
            }
        }

        $employee->fill($validated);
        if (array_key_exists('franchise_id', $validated) && $employee->isDirty('franchise_id')) {
            $employee->api_token = null;
        }
        if ((array_key_exists('is_active', $validated) && ! $validated['is_active'])
            || (isset($validated['position']) && $employee->isDirty('position'))) {
            $employee->api_token = null;
        }
        $employee->save();

        return response()->json($employee->load(['franchise.franchiseAccount']));
    }

    // Delete an employee
    public function destroy($id)
    {
        $employee = Employee::findOrFail($id);
        $employee->delete();

        return response()->json(['message' => 'Employee deleted successfully']);
    }

    // Reset an employee's password
    public function resetPassword(Request $request, $id)
    {
        $request->validate([
            'password' => 'required|string|min:6'
        ]);

        $employee = Employee::findOrFail($id);
        $employee->api_token = null;
        $employee->update([
            'password' => $request->password
        ]);
        
        return response()->json(['message' => 'Password reset successfully']);
    }

    private function emailUsedByOtherStaff(string $email): bool
    {
        return \App\Models\FranchiseUser::whereRaw('LOWER(email) = ?', [$email])->exists()
            || \App\Models\Driver::whereRaw('LOWER(email) = ?', [$email])->exists();
    }
}
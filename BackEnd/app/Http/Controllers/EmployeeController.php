<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    // Fetch all employees
    public function index()
    {
        return Employee::select('id', 'fullName', 'email', 'position')->get();
    }

    // Create a new employee
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fullName' => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:employees,email',
            'password' => 'required|string|min:6',
            'position' => 'required|in:cashier,kitchen staff',
        ]);

        
        return Employee::create($validated);
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
        
        // Again, automatically hashed by the Model
        $employee->update([
            'password' => $request->password
        ]);
        
        return response()->json(['message' => 'Password reset successfully']);
    }
}
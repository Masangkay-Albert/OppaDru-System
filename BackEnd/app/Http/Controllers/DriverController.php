<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    // Fetch all drivers
    public function index()
    {
        return response()->json(Driver::all());
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
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|string|email|max:255|unique:drivers,email',
            'password'    => 'required|string|min:6',
            'phone'       => 'required|string|max:20',
            'vehicleType' => 'required|string|max:100',
            'isActive'    => 'boolean',
        ]);

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

        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'email'       => 'sometimes|string|email|max:255|unique:drivers,email,' . $driver->id,
            'phone'       => 'sometimes|string|max:20',
            'vehicleType' => 'sometimes|string|max:100',
            'isActive'    => 'sometimes|boolean',
        ]);

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
            'password' => 'required|string|min:6'
        ]);

        $driver = Driver::findOrFail($id);
        
        // Automatically hashed by the Model
        $driver->update([
            'password' => $request->password
        ]);
        
        return response()->json(['message' => 'Password reset successfully']);
    }
}